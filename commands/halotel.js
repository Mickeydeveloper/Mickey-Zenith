const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');
const axios = require('axios');

// ────────────────────────────────────────────────
const PRICE_PER_GB = 1000; // TSh per GB
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_JID = `${SELLER_NUMBER}@s.whatsapp.net`;
const SELLER_NAME = 'MICKDADI HAMZA SALIM';

const AD_BANNER_1 = 'https://files.catbox.moe/1mv2al.jpg';   // Calculation banner
const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';   // Payment banner
const CONFIRMATION_AUDIO = 'https://files.catbox.moe/t80fnj.mp3'; // Fallback audio

const AXIOS_DEFAULTS = {
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

// Simple in-memory order counter (use database in production)
let orderCounter = 1000;

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateOrderRef() {
    return `HALO-${Date.now().toString().slice(-6)}-${++orderCounter}`;
}

// Enhanced audio download with retry logic
async function downloadAudioBuffer(audioUrl, maxAttempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`[Halotel] Audio download attempt ${attempt}/${maxAttempts}...`);
            const response = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 45000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: s => s >= 200 && s < 400,
                ...AXIOS_DEFAULTS
            });
            const audioBuffer = Buffer.from(response.data);
            if (audioBuffer.length === 0) {
                throw new Error('Downloaded buffer is empty');
            }
            console.log(`[Halotel] Audio downloaded: ${audioBuffer.length} bytes`);
            return audioBuffer;
        } catch (err) {
            lastError = err;
            console.error(`[Halotel] Attempt ${attempt} failed:`, err?.message);
            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
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
                text: `╔════════════════════════════════╗
║     ⚡ HALOTEL BUNDLE SHOP ⚡   ║
╚════════════════════════════════╝

🎁 *Buy Fast & Cheap Data Bundles!*

📝 *HOW TO ORDER:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Command: .halotel <GB> <number> [name]

💡 *EXAMPLES:*
📌 .halotel 20 255612130873 Mickey
📌 .halotel 50 255768990011
📌 .halotel 100 255123456789

⚙️ *PRICING:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 TSh ${formatNumber(PRICE_PER_GB)}/GB
📦 Minimum Order: ${MIN_GB} GB
💵 Example: 20GB = TSh ${formatNumber(20 * PRICE_PER_GB)}

✨ *FEATURES:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Instant Delivery
✅ Secure Payment
✅ 24/7 Support
✅ No Hidden Charges

❓ Need help? Reply to this message!`
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
`╭═════════════════════════════════╮
║  📋 ORDER CONFIRMATION SUMMARY   ║
╰═════════════════════════════════╯

📦 *Bundle Details:*
├─ 📶 Data:      ${gbAmount} GB
├─ 💰 Price:     TSh ${formatNumber(totalPrice)}
├─ 📱 To:        +${phoneNumber}
├─ 👤 Name:      ${customerName || '(Not provided)'}
└─ 🆔 Order ID:  ${orderRef}

╭═════════════════════════════════╮
║  ⏳ Waiting for payment...       ║
╰═════════════════════════════════╯`;

        let banner1 = null;
        try { 
            banner1 = await getBuffer(AD_BANNER_1); 
        } catch (e) { 
            console.log('[Halotel] Banner 1 load failed:', e?.message); 
        }

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
`╭═════════════════════════════════╮
║  💳 PAYMENT & CONFIRMATION       ║
╰═════════════════════════════════╯

👤 *Seller Information:*
├─ Name:    ${SELLER_NAME}
├─ Phone:   +${SELLER_NUMBER}
└─ Status:  🟢 Online 24/7

💵 *Payment Details:*
├─ Amount:  TSh ${formatNumber(totalPrice)}
├─ Order:   ${orderRef}
└─ Method:  M-Pesa/Card Accepted

📝 *After Payment:*
1️⃣ Send payment screenshot here
2️⃣ Or reply: PAID ${orderRef} [M-Pesa ID]
3️⃣ Confirm with seller below

⚡ *Guaranteed:*
✅ Delivery in < 5 minutes
✅ Secure transaction
✅ Money-back guarantee

╰═════════════════════════════════╯`;

        let banner2 = null;
        try { 
            banner2 = await getBuffer(AD_BANNER_2); 
        } catch (e) { 
            console.log('[Halotel] Banner 2 load failed:', e?.message); 
        }

        const buttons = [
            {
                urlButton: {
                    displayText: '💳 Pay via WhatsApp',
                    url: `https://wa.me/${SELLER_NUMBER}?text=${encodeURIComponent(
                        `New Order ${orderRef}\n${gbAmount} GB to ${phoneNumber}\nAmount: TSh ${formatNumber(totalPrice)}\nName: ${customerName || '—'}`
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
        await new Promise(r => setTimeout(r, 1400));

        // ─── Final Confirmation + Audio ─────────────────────────────
        const confirmText = `✅ *Order ${orderRef} Received!*

Your order has been placed successfully. 
Please proceed with payment to finalize delivery.

Thank you for choosing Halotel! 🚀`;

        await sock.sendMessage(chatId, {
            text: confirmText
        }, { quoted: message });

        await new Promise(r => setTimeout(r, 1500));

        // ─── Send Confirmation Audio with Fallback ──────────────────
        try {
            console.log('[Halotel] Attempting to send audio confirmation...');
            const audioBuffer = await downloadAudioBuffer(CONFIRMATION_AUDIO, 3);
            
            // Send as PTT (Push-to-talk/voice note) with proper mimetype
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `order-confirmation-${orderRef}.mp3`,
                ptt: false // Set to false for normal audio playback
            });
            console.log('[Halotel] Audio confirmation sent successfully');
        } catch (audioErr) {
            console.error('[Halotel] Audio send failed:', audioErr?.message);
            // Graceful fallback - no error message to user, just continue
            // Audio is optional, not critical to order
        }

        // Notify seller privately
        await sock.sendMessage(SELLER_JID, {
            text: `🔔 *NEW HALOTEL ORDER*\n\n` +
                  `╭═════════════════════════════════╮\n` +
                  `║  ORDER DETAILS\n` +
                  `╰═════════════════════════════════╯\n\n` +
                  `🆔 Order ID:    ${orderRef}\n` +
                  `📦 Data:        ${gbAmount} GB\n` +
                  `📱 To:          +${phoneNumber}\n` +
                  `👤 Name:        ${customerName || '(Not provided)'}\n` +
                  `💰 Amount:      TSh ${formatNumber(totalPrice)}\n` +
                  `⏱️  Time:        ${new Date().toLocaleString()}\n` +
                  `💬 Customer:    ${chatId.split('@')[0]}\n\n` +
                  `⚠️ Awaiting payment confirmation...`
        }).catch(err => {
            console.error('[Halotel] Seller notification failed:', err?.message);
        });

    } catch (error) {
        console.error('[Halotel] Command error:', error?.message);
        const errorMsg = error?.message || String(error);
        
        let userMessage = '⚠️ Something went wrong. Please try again.';
        if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
            userMessage = '❌ Invalid order details. Check amount, number, and try again.';
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
            userMessage = '⚠️ Network error. Please check your connection and try again.';
        } else if (errorMsg.includes('amount') || errorMsg.includes('GB')) {
            userMessage = `❌ Invalid amount. Minimum is ${MIN_GB} GB.\nExample: .halotel 20 255xxxxxxxxx`;
        }
        
        try {
            await sock.sendMessage(chatId, {
                text: userMessage
            }, { quoted: message });
        } catch (sendErr) {
            console.error('[Halotel] Error message send failed:', sendErr?.message);
        }
    }
}

module.exports = halotelCommand;