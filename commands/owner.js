const settings = require('../settings');
const { getBuffer } = require('../lib/myfunc');
const QRCode = require('qrcode'); // Ensure 'qrcode' is installed: npm i qrcode

async function ownerCommand(sock, chatId, message) {
    try {
        // Generate QR code for direct WhatsApp chat
        const ownerNumberRaw = '255615944741';
        const ownerNumberDisplay = '+' + ownerNumberRaw;
        const waLink = `https://wa.me/${ownerNumberRaw}`;
        const qrBuffer = await QRCode.toBuffer(waLink, { width: 512 });

        // Optional professional thumbnail (use a real owner/business photo for trust)
        const thumbnailUrl = 'https://water-billimg.onrender.com/1761205727440.png'; // Your existing image now used as ad thumbnail
        let thumbnailBuffer = null;
        try {
            thumbnailBuffer = await getBuffer(thumbnailUrl);
        } catch (err) {
            console.warn('Failed to load thumbnail for ad');
        }

        // First: Professional ad-like message with thumbnail (image moved here)
        await sock.sendMessage(chatId, {
            text: `*Official Bot Owner*\n\n` +
                  `👤 *${settings.botOwner}*\n` +
                  `📱 +${settings.ownerNumber}\n` +
                  `🤖 Owner of ${settings.botName}\n\n` +
                  `Tap below to connect directly.`,
            contextInfo: {
                externalAdReply: {
                    title: `${settings.botOwner} - Bot Owner`,
                    body: 'Direct & Secure Contact',
                    mediaType: 1,
                    sourceUrl: waLink,
                    thumbnail: thumbnailBuffer,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

        // Removed entire second section (image message with template buttons)

        // Third: Professional vCard + QR code for easy contact saving/scanning
        const projectUrl = settings.updateZipUrl || 'https://github.com/Mickeydeveloper/Mickey-Glitch';
        const fbUrl = settings.facebookUrl || 'https://www.facebook.com';

        const vcard = `BEGIN:VCARD\n` +
                      `VERSION:3.0\n` +
                      `FN:${settings.botOwner}\n` +
                      `ORG:${settings.botName}\n` +
                      `TEL;type=CELL;type=VOICE;waid=${ownerNumberRaw}:${ownerNumberDisplay}\n` +
                      `URL:${projectUrl || ''}\n` +
                      `NOTE:Official Bot Owner - Direct Contact\n` +
                      `END:VCARD`;

        // Send vCard
        await sock.sendMessage(chatId, {
            contacts: {
                displayName: `${settings.botOwner} (Owner)`,
                contacts: [{ vcard }]
            }
        }, { quoted: message });

        // Send QR code as bonus for easy scanning
        await sock.sendMessage(chatId, {
            image: qrBuffer,
            caption: '📲 *Scan to start chat with the owner*'
        }, { quoted: message });

    } catch (error) {
        console.error('Error in owner command:', error);
        await sock.sendMessage(chatId, {
            text: '⚠️ Temporary issue loading owner info. Please try again shortly.'
        }, { quoted: message });
    }
}

module.exports = ownerCommand;
