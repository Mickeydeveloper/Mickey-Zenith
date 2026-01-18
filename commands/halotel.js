const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');

// ────────────────────────────────────────────────
const PRICE_PER_GB = 1000; // TSh per GB
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_JID = `${SELLER_NUMBER}@s.whatsapp.net`;
const SELLER_NAME = 'MICKDADI HAMZA SALIM';

const AD_BANNER_1 = 'https://files.catbox.moe/1mv2al.jpg';   // Calculation banner
const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';   // Payment banner
const CONFIRMATION_AUDIO = 'https://files.catbox.moe/t80fnj.mp3';

// Simple in-memory order counter (use database in production)
let orderCounter = 1000;

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateOrderRef() {
    return `HALO-\( {Date.now().toString().slice(-6)}- \){++orderCounter}`;
}

async function halotelCommand(sock, chatId, message, userMessage = '') {
    try {
        // Only allow in private chats
        if (chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '🔒 This command works only in private chat for security.'
            }, { quoted: message });
            return;
        }

        const text = (userMessage ||
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '').trim().toLowerCase();

        const args = text.split(/\s+/).slice(1);

        if (args.length === 0) {
            await sock.sendMessage(chatId, {
                text: `*⚡ HALOTEL BUNDLE SHOP ⚡*\n\n` +
                      `Buy fast & cheap Halotel data bundles!\n\n` +
                      `Examples:\n` +
                      `• .halotel 20 255612130873 Mickey\n` +
                      `• .halotel gb50 255768990011\n` +
                      `• .halotel 100 255123456789\n\n` +
                      `Minimum order: 10 GB`
            }, { quoted: message });
            return;
        }

        // ─── Parse arguments ────────────────────────────────────────
        let gbAmount = null;
        let phoneNumber = null;
        let customerName = '';

        // Find GB amount
        for (let i = 0; i < args.length; i++) {
            const part = args[i].replace(/[^0-9]/g, '');
            const num = parseInt(part, 10);
            if (!isNaN(num) && num >= MIN_GB) {
                gbAmount = num;
                args.splice(i, 1);
                break;
            }
        }

        // Find phone number
        for (let i = 0; i < args.length; i++) {
            const digits = args[i].replace(/[^0-9]/g, '');
            if (digits.length >= 9 && digits.length <= 13) {
                phoneNumber = digits;
                args.splice(i, 1);
                break;
            }
        }

        // Rest is customer name
        if (args.length > 0) {
            customerName = args.join(' ').trim();
        }

        // ─── Validation ─────────────────────────────────────────────
        if (!gbAmount || gbAmount < MIN_GB) {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid amount\nMinimum is 10 GB\nExample: .halotel 20 2556xxxxxxxx'
            }, { quoted: message });
            return;
        }

        if (!phoneNumber) {
            await sock.sendMessage(chatId, {
                text: '❌ Phone number required\nExample: .halotel 30 255612345678 YourName'
            }, { quoted: message });
            return;
        }

        const totalPrice = gbAmount * PRICE_PER_GB;
        const orderRef = generateOrderRef();

        // ─── Step 1: Order Summary ──────────────────────────────────
        const summaryText = 
`╭━━━✦ HALOTEL BUNDLE ORDER ✦━━━╮
┃
┃  📶 Bundle:     ${gbAmount} GB
┃  💰 Price:      TSh ${formatNumber(totalPrice)}
┃  📱 To:         ${phoneNumber}
┃  👤 Name:       ${customerName || 'Not provided'}
┃  📋 Ref:        ${orderRef}
┃
╰━━━✦ Confirm & Pay ✦━━━╯`;

        let banner1 = null;
        try { banner1 = await getBuffer(AD_BANNER_1); } catch {}

        await sock.sendMessage(chatId, {
            text: summaryText,
            contextInfo: banner1 ? {
                externalAdReply: {
                    title: `Order ${orderRef}`,
                    body: `${gbAmount} GB • TSh ${formatNumber(totalPrice)}`,
                    thumbnail: banner1,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: settings.homepage || ''
                }
            } : {}
        }, { quoted: message });

        await new Promise(r => setTimeout(r, 1400));

        // ─── Step 2: Payment Instructions ───────────────────────────
        const paymentText = 
`╭━━━✦ PAYMENT & CONFIRMATION ✦━━━╮
┃ Seller: ${SELLER_NAME}
┃ Contact: +${SELLER_NUMBER}
┃ Amount: TSh ${formatNumber(totalPrice)}
┃ Order Ref: ${orderRef}
┃
┃ After payment:
┃ • Send screenshot here
┃ • Or reply: PAID ${orderRef} [M-Pesa ID]
┃
┃ Delivery in < 5 minutes after confirmation
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        let banner2 = null;
        try { banner2 = await getBuffer(AD_BANNER_2); } catch {}

        const buttons = [
            {
                urlButton: {
                    displayText: '💳 Pay via WhatsApp',
                    url: `https://wa.me/\( {SELLER_NUMBER}?text= \){encodeURIComponent(
                        `New Order \( {orderRef}\n \){gbAmount} GB to ${phoneNumber}\nAmount: TSh ${formatNumber(totalPrice)}\nName: ${customerName || '—'}`
                    )}`
                }
            },
            {
                quickReplyButton: {
                    displayText: '📞 Contact Seller',
                    id: `.contact ${SELLER_NUMBER}`
                }
            }
        ];

        await sendButtons(
            sock,
            chatId,
            paymentText,
            'Choose how to pay →',
            buttons,
            message,
            banner2 ? { contextInfo: {
                externalAdReply: {
                    title: 'Secure Payment',
                    body: 'Fast confirmation • Instant delivery',
                    thumbnail: banner2,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }} : {}
        );

        // ─── Final Confirmation + Audio ─────────────────────────────
        await new Promise(r => setTimeout(r, 1000));

        await sock.sendMessage(chatId, {
            text: `✅ *Order ${orderRef} received!*\n\nReply with payment proof to finalize.\nThank you for choosing us! 🚀`
        });

        await new Promise(r => setTimeout(r, 1200));

        // Send as voice note (PTT)
        try {
            await sock.sendMessage(chatId, {
                audio: { url: CONFIRMATION_AUDIO },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                seconds: 12,                    // approximate duration (adjust to your file)
                fileName: 'order-confirmation.opus',
                caption: '🎙️ Thank you for your order!'
            });
        } catch (err) {
            console.error('[Audio PTT failed]', err.message);
            // Fallback: normal audio file
            await sock.sendMessage(chatId, {
                audio: { url: CONFIRMATION_AUDIO },
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: `🎵 Order confirmation audio (Ref: ${orderRef})\nTap to play`
            });
        }

        // Notify seller privately
        await sock.sendMessage(SELLER_JID, {
            text: `🔔 *New Halotel Order*\n\n` +
                  `Ref: ${orderRef}\n` +
                  `GB: ${gbAmount}\n` +
                  `To: ${phoneNumber}\n` +
                  `Name: ${customerName || '—'}\n` +
                  `Total: TSh ${formatNumber(totalPrice)}\n` +
                  `Customer chat: ${chatId.split('@')[0]}`
        }).catch(() => {});

    } catch (error) {
        console.error('Halotel command error:', error);
        await sock.sendMessage(chatId, {
            text: '⚠️ Something went wrong. Please try again or contact support.'
        }, { quoted: message });
    }
}

module.exports = halotelCommand;