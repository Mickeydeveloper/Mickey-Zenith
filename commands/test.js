// donate.js
// Command: .donate <phone> [amount]
// Works in **private chats** AND **groups** (no group-only restriction)

import fetch from 'node-fetch';

const userCooldown = new Set();
const pendingDonations = new Map();
const processedDonations = new Set();

export async function donate(message, client) {
    const remoteJid = message.key.remoteJid;

    try {
        // ---------- 1. Extract phone & amount ----------
        const messageBody = message.message?.conversation ||
                            message.message?.extendedTextMessage?.text || "";

        const commandAndArgs = messageBody.slice(1).trim();   // remove leading "."
        const parts = commandAndArgs.split(/\s+/);
        const text = parts.slice(1).join(' ') || '\u200B';

        let phone = '';
        let amount = 500;

        if (text.includes(' ')) {
            const [inputPhone, inputAmount] = text.split(' ');
            phone = inputPhone.trim();
            amount = parseInt(inputAmount) || 500;
        } else {
            phone = text.trim();
        }

        // ---------- 2. Validate phone ----------
        if (!phone || !/^(0\d{8,9}|\+255\d{9})$/.test(phone)) {
            await client.sendMessage(remoteJid, {
                text: `Invalid phone number.\n\nExample:\n.donate 0758868502 1000`
            });
            return;
        }

        if (phone.startsWith('0')) {
            phone = '255' + phone.slice(1);
        } else if (phone.startsWith('+255')) {
            phone = phone.slice(1);
        }

        // ---------- 3. Cooldown ----------
        const sender = message.key.participant || message.key.fromMe || message.key.remoteJid;
        if (userCooldown.has(sender)) {
            await client.sendMessage(remoteJid, {
                text: 'Please wait 5 minutes before donating again.'
            });
            return;
        }

        // ---------- 4. Build payload ----------
        const orderId = `DON-${Date.now()}`;
        const payload = {
            order_id: orderId,
            buyer_name: message.pushName || 'Anonymous',
            buyer_phone: phone,
            amount: amount
        };

        // ---------- 5. Initiate payment ----------
        userCooldown.add(sender);
        setTimeout(() => userCooldown.delete(sender), 5 * 60 * 1000);

        const res = await fetch('https://api-pay-du0j.onrender.com/make-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.status === 'success') {
            pendingDonations.set(orderId, {
                chat: remoteJid,
                user: sender,
                amount,
                phone,
                timestamp: Date.now()
            });

            const msg = `《Donation Initiated》\n\n` +
                        `Order ID: ${orderId}\n` +
                        `Amount: ${amount} TZS\n` +
                        `Phone: ${phone}\n\n` +
                        `Check your phone for an STK pop-up and enter your PIN.\n` +
                        `I'll notify you once payment is confirmed.`;

            await client.sendMessage(remoteJid, { text: msg });
            pollPaymentConfirmation(orderId, remoteJid, client);
        } else {
            await client.sendMessage(remoteJid, {
                text: `Failed: ${data.message || 'Unknown error'}`
            });
        }

    } catch (error) {
        console.error("_Error in donate command:_", error);
        await client.sendMessage(remoteJid, {
            text: 'Server error. Try again later.'
        });
    }
}

// ---------------------------------------------------------------------
// Polling function (works in private or group)
async function pollPaymentConfirmation(orderId, chatJid, client) {
    const maxAttempts = 2;
    const delay = 30 * 1000;
    let attempts = 0;

    const check = async () => {
        try {
            const res = await fetch(`https://api-pay-du0j.onrender.com/check-payment?order_id=${orderId}`);
            const data = await res.json();

            if (data.status === 'completed' && !processedDonations.has(orderId)) {
                const donation = pendingDonations.get(orderId);
                if (donation) {
                    const successMsg = `Donation Confirmed!\n\n` +
                                       `Order ID: ${orderId}\n` +
                                       `Amount: ${donation.amount} TZS\n` +
                                       `Phone: ${donation.phone}\n\n` +
                                       `Thank you for your support!`;

                    await client.sendMessage(chatJid, { text: successMsg });
                    processedDonations.add(orderId);
                    pendingDonations.delete(orderId);
                }
                return;
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(check, delay);
            } else {
                const donation = pendingDonations.get(orderId);
                if (donation) {
                    await client.sendMessage(
                        chatJid,
                        { text: `Payment for order ${orderId} not confirmed yet. Check your mobile money history.` }
                    );
                    pendingDonations.delete(orderId);
                }
            }
        } catch (err) {
            console.error('Confirmation check error:', err);
            if (attempts < maxAttempts) setTimeout(check, delay);
        }
    };

    setTimeout(check, delay);
}

// ---------------------------------------------------------------------
export default donate;

export default test