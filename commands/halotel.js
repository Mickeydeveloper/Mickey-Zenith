const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');

// Constants for easy management
const PRICE_PER_GB = 1000; // TSh per GB
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_NAME = 'MICKDADI HAMZA SALIM';
const AD_BANNER_1 = 'https://files.catbox.moe/1mv2al.jpg';   // Calculation banner
const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';   // Payment banner

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function halotelCommand(sock, chatId, message, userMessage = '') {
    try {
        // Restrict to private chat only
        if (chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '🔒 *Private Chat Only*\n\nThis command works only in direct messages for security and privacy.'
            }, { quoted: message });
            return;
        }

        // Extract text
        const text = (userMessage || 
            message.message?.conversation || 
            message.message?.extendedTextMessage?.text || ''
        ).trim();

        const args = text.split(/\s+/).slice(1);

        if (args.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `*⚡ HALOTEL BUNDLE SHOP ⚡*\n\n` +
                      `📦 Buy fast Halotel data bundles at the best price!\n\n` +
                      `💡 *Usage Examples:*\n` +
                      `• .halotel gb20 255612130873 Mickey\n` +
                      `• .halotel 50 255768990011 John Doe\n` +
                      `• .halotel gb100 255123456789\n\n` +
                      `🔻 Minimum: 10 GB`
            }, { quoted: message });
        }

        // === Smart Argument Parsing ===
        let gbAmount = null;
        let phoneNumber = null;
        let customerName = '';

        // Detect GB amount (gb10, GB50, 30, etc.)
        for (let i = 0; i < args.length; i++) {
            const part = args[i].toLowerCase();
            if (part.startsWith('gb') && !gbAmount) {
                const num = parseInt(part.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num >= MIN_GB) {
                    gbAmount = num;
                    args.splice(i, 1);
                    i--;
                }
            } else if (!gbAmount && !isNaN(part)) {
                const num = parseInt(part, 10);
                if (num >= MIN_GB && num <= 10000) {
                    gbAmount = num;
                    args.splice(i, 1);
                    i--;
                }
            }
        }

        // Extract phone number (longest numeric string)
        for (let i = 0; i < args.length; i++) {
            const digits = args[i].replace(/[^0-9]/g, '');
            if (digits.length >= 9 && digits.length <= 15) {
                phoneNumber = digits;
                args.splice(i, 1);
                break;
            }
        }

        // Remaining = customer name
        if (args.length > 0) {
            customerName = args.join(' ').trim();
        }

        // === Validation ===
        if (!gbAmount || gbAmount < MIN_GB) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid Bundle Amount*\n\nMinimum allowed is *10 GB*\nExample: `gb20` or `50`'
            }, { quoted: message });
        }

        if (!phoneNumber) {
            return await sock.sendMessage(chatId, {
                text: '📱 *Phone Number Required*\n\nPlease provide the recipient number:\nExample: `.halotel gb30 255612130873 Mickey`'
            }, { quoted: message });
        }

        const totalPrice = gbAmount * PRICE_PER_GB;

        // === Step 1: Bundle Confirmation with Futuristic Banner ===
        const confirmationText = 
`╭━━━✦ *HALOTEL DATA BUNDLE* ✦━━━╮
┃                                  
┃  📶 *Bundle Size:*   ${gbAmount} GB
┃  💰 *Price per GB:*  TSh ${formatNumber(PRICE_PER_GB)}
┃  ─────────────────────────────
┃  💳 *Total Amount:*  TSh ${formatNumber(totalPrice)}
┃                                  
┃  📱 *Recipient:*     ${phoneNumber}
┃  👤 *Name (Opt):*    ${customerName || 'Not provided'}
┃                                  
╰━━━✦ *Ready to Purchase?* ✦━━━╯

🚀 Powered by premium Halotel network`;

        let bannerBuffer = null;
        try {
            bannerBuffer = await getBuffer(AD_BANNER_1);
        } catch (e) {
            console.log('Banner 1 failed to load');
        }

        const adReply1 = bannerBuffer ? {
            externalAdReply: {
                title: "⚡ HALOTEL BUNDLE ORDER",
                body: `${gbAmount} GB • TSh ${formatNumber(totalPrice)}`,
                thumbnail: bannerBuffer,
                mediaType: 1,
                renderLargerThumbnail: true,
                sourceUrl: settings.homepage || ''
            }
        } : {};

        await sock.sendMessage(chatId, {
            text: confirmationText,
            contextInfo: adReply1
        }, { quoted: message });

        // Small futuristic delay
        await new Promise(r => setTimeout(r, 1500));

        // === Step 2: Payment Options with Sleek Design ===
        const waPayLink = `https://wa.me/\( {SELLER_NUMBER}?text= \){encodeURIComponent(
            `Hello \( {SELLER_NAME},\n\nI want to buy * \){gbAmount} GB* Halotel bundle\n` +
            `📱 Recipient: ${phoneNumber}\n` +
            `👤 Name: ${customerName || '—'}\n` +
            `💰 Amount: TSh ${formatNumber(totalPrice)}\n\nPlease process my order. Thank you!`
        )}`;

        const paymentText = 
`╭━━━✦ *SECURE PAYMENT* ✦━━━╮
┃                               
┃  👤 *Seller:* ${SELLER_NAME}
┃  ☎️  *Contact:* +${SELLER_NUMBER}
┃  💰 *Pay:* TSh ${formatNumber(totalPrice)}
┃                               
┃  🔹 After payment, reply here with:
┃     • Transaction ID / Screenshot
┃     • Confirmation message
┃                               
┃  ⏱ Bundle delivered in < 5 mins
╰━━━✦ *Fast • Safe • Reliable* ✦━━━╯`;

        let paymentBanner = null;
        try {
            paymentBanner = await getBuffer(AD_BANNER_2);
        } catch (e) {
            console.log('Payment banner failed');
        }

        const buttons = [
            {
                urlButton: {
                    displayText: '💸 Pay via WhatsApp',
                    url: waPayLink
                }
            },
            {
                quickReplyButton: {
                    displayText: '☎️ Contact Seller',
                    id: `.contact ${SELLER_NUMBER} ${SELLER_NAME}`
                }
            },
            {
                quickReplyButton: {
                    displayText: '📋 Order History',
                    id: '.myorders' // You can implement this later
                }
            }
        ];

        const adReply2 = paymentBanner ? {
            externalAdReply: {
                title: "🔐 SECURE PAYMENT GATEWAY",
                body: "Tap to pay • Instant delivery",
                thumbnail: paymentBanner,
                sourceUrl: waPayLink,
                mediaType: 1,
                renderLargerThumbnail: true
            }
        } : {};

        await sendButtons(
            sock,
            chatId,
            paymentText,
            'Choose Payment Method',
            buttons,
            message,
            { contextInfo: adReply2 }
        );

        // Optional: Send final confirmation
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(chatId, {
            text: '✨ *Order logged successfully!*\n\nWe\'re ready when you are. Payment confirms instant delivery 🚀'
        });

    } catch (error) {
        console.error('Error in halotel command:', error);
        try {
            await sock.sendMessage(chatId, {
                text: '⚠️ *System Error*\n\nSomething went wrong. Please try again in a moment.\n\nSupport: Contact admin if issue persists.'
            }, { quoted: message });
        } catch (e) {}
    }
}

module.exports = halotelCommand;