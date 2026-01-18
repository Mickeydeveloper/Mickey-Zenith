const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');

// Constants
const PRICE_PER_GB = 1000; // TSh per GB
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_JID = `${SELLER_NUMBER}@s.whatsapp.net`;
const SELLER_NAME = 'MICKDADI HAMZA SALIM';
const AD_BANNER_1 = 'https://files.catbox.moe/1mv2al.jpg';
const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';
const ORDER_AUDIO_URL = 'https://files.catbox.moe/t80fnj.mp3'; // your audio

let orderCounter = 1000; // simple in-memory counter (use DB in production)

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateOrderRef() {
    return `HALO-\( {Date.now().toString().slice(-6)}- \){++orderCounter}`;
}

async function halotelCommand(sock, chatId, message, userMessage = '') {
    try {
        if (chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '🔒 Private Chat Only for orders' }, { quoted: message });
            return;
        }

        const text = (userMessage || message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const args = text.split(/\s+/).slice(1);

        if (args.length === 0) {
            return sock.sendMessage(chatId, {
                text: `*⚡ HALOTEL BUNDLE SHOP ⚡*\n\nExamples:\n• .halotel 20 255612130873 Mickey\n• .halotel gb50 255768990011\nMin: 10 GB`
            }, { quoted: message });
        }

        // Parse args (same as before)
        let gbAmount = null, phoneNumber = null, customerName = '';
        // ... (keep your parsing logic here)

        // Validation (keep yours)

        const totalPrice = gbAmount * PRICE_PER_GB;
        const orderRef = generateOrderRef();

        // Step 1: Confirmation
        // ... (keep your banner + text)

        // Step 2: Payment + improved collection
        const waMessage = `New Order!\nRef: \( {orderRef}\n \){gbAmount} GB to ${phoneNumber}\nName: ${customerName || '—'}\nAmount: TSh ${formatNumber(totalPrice)}\nPlease process.`;
        const waPayLink = `https://wa.me/\( {SELLER_NUMBER}?text= \){encodeURIComponent(waMessage)}`;

        const paymentText = 
`╭━━━✦ *PAY & CONFIRM* ✦━━━╮
┃ Seller: \( {SELLER_NAME} (+ \){SELLER_NUMBER})
┃ Amount: TSh ${formatNumber(totalPrice)}
┃ Ref: ${orderRef}
┃
┃ After payment:
┃ 1. Send screenshot / M-Pesa ID here
┃ 2. Or reply: PAID ${orderRef} [ID]
┃
┃ Delivery: <5 mins after confirm
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;

        // ... (keep buttons + sendButtons)

        await new Promise(r => setTimeout(r, 1000));

        await sock.sendMessage(chatId, {
            text: `✨ *Order ${orderRef} logged!*\n\nReply with payment proof to confirm. We'll notify you once processed 🚀`
        });

        // Send audio confirmation (fixed version)
        await new Promise(r => setTimeout(r, 1500));

        try {
            await sock.sendMessage(chatId, {
                audio: { url: ORDER_AUDIO_URL },
                mimetype: 'audio/ogg; codecs=opus', // better for PTT / voice note
                ptt: true,
                seconds: 12, // hint duration (adjust to your audio length)
                fileName: 'order-received.mp3',
                caption: '🎙️ Order received – thank you!' // fallback text
            });
            console.log('[Halotel] Audio sent (opus PTT)');
        } catch (err) {
            console.error('[Audio Fail]', err.message);
            // Fallback: send as normal audio + caption
            await sock.sendMessage(chatId, {
                audio: { url: ORDER_AUDIO_URL },
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: '🎵 Order confirmation audio (tap to play)\nRef: ' + orderRef
            });
        }

        // Bonus: Notify seller privately with full details
        await sock.sendMessage(SELLER_JID, {
            text: `🆕 New Halotel Order!\nRef: ${orderRef}\nGB: ${gbAmount}\nTo: ${phoneNumber}\nName: ${customerName || '—'}\nTotal: TSh ${formatNumber(totalPrice)}\nChat: ${chatId.split('@')[0]}`
        }).catch(() => {});

    } catch (error) {
        console.error('Halotel error:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Error – try again or contact support' }, { quoted: message });
    }
}

module.exports = halotelCommand;