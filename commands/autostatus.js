
const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

// Config path
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(configPath))) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

// Config
let config = {
    enabled: true,
    reactOn: true,
    forwardToOwner: true
};

// Load config
if (fs.existsSync(configPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config = { ...config, ...loaded };
    } catch (e) {
        console.error('Config load error:', e.message);
    }
} else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Save config safely
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Config save failed:', error.message);
        return false;
    }
}

// Get owner JID (where statuses are forwarded to)
function getOwnerJid(sock) {
    return sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    // return '255612130873@s.whatsapp.net'; // ← Uncomment to hardcode a different number
}

// Improved: Better detection of original sender in forwarded statuses
async function getOriginalSenderInfo(sock, message) {
    let senderJid = message.key.participant || message.key.remoteJid;
    let senderNumber = senderJid.split('@')[0];

    let originalNumber = null;
    let originalName = null;

    const ctx = message.message?.imageMessage?.contextInfo ||
                message.message?.videoMessage?.contextInfo ||
                message.message?.extendedTextMessage?.contextInfo ||
                message.contextInfo;

    if (ctx) {
        // Forwarded multiple times?
        if (ctx.isForwarded || ctx.forwardingScore > 0) {
            if (ctx.participant) {
                originalNumber = ctx.participant.split('@')[0];
            }
        }

        // Quoted message inside forward?
        if (ctx.quotedMessage?.key?.participant) {
            originalNumber = ctx.quotedMessage.key.participant.split('@')[0];
        } else if (ctx.quotedMessage?.key?.remoteJid) {
            originalNumber = ctx.quotedMessage.key.remoteJid.split('@')[0];
        }
    }

    // Fallback: if no original found, use direct sender
    if (!originalNumber) originalNumber = senderNumber;

    // Resolve name
    let displayName = originalNumber;
    let isVerified = '';
    try {
        const contact = await sock.getContactById(originalNumber + '@s.whatsapp.net');
        const name = contact?.notify || contact?.name || contact?.verifiedName;
        if (name && name !== originalNumber) displayName = name;
        if (contact?.verifiedName) isVerified = ' ✅';
    } catch (e) {
        // Silent fail
    }

    const isForwarded = originalNumber !== senderNumber;

    return {
        displayName,
        number: originalNumber,
        isForwarded,
        directSenderNumber: senderNumber,
        isVerified
    };
}

// Forward status to owner with clear info
async function forwardStatusToOwner(sock, message) {
    try {
        if (!config.forwardToOwner) return;

        const ownerJid = getOwnerJid(sock);
        if (!ownerJid) return;

        const msgType = message.message;
        if (!msgType?.imageMessage && !msgType?.videoMessage) return;

        const senderInfo = await getOriginalSenderInfo(sock, message);

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString();

        let fromLine;
        if (senderInfo.isForwarded) {
            fromLine = `\( {senderInfo.displayName} ( \){senderInfo.number})\n↪ Forwarded from: ${senderInfo.directSenderNumber}`;
        } else {
            fromLine = `\( {senderInfo.displayName} ( \){senderInfo.number})`;
        }

        const caption = `🟢 New Private Status\n👤 From: \( {fromLine} \){senderInfo.isVerified}\n🕓 Time: ${date} ${time}`;

        await sock.sendMessage(ownerJid, { forward: message, caption });
        console.log(`Forwarded status from ${senderInfo.number} (display: \( {senderInfo.displayName}) \){senderInfo.isForwarded ? ' [forwarded]' : ''}`);
    } catch (error) {
        console.error('Forward error:', error.message);
    }
}

// Updated Menu with green heart and correct info
const getStatusMenu = (targetNum, isForwardEnabled) => `
╭━━━━━━━━✦ Auto Status ✦━━━━━━━━╮
┃                               ┃
┃  📱 View    : Always Active 🔒 ┃
┃  💚 React   : Always Active 💚 ┃
┃  ➡️ Forward : ${isForwardEnabled ? '✅ ENABLED' : '❌ DISABLED'}       ┃
┃  👤 Target  : ${targetNum}     ┃
┃                               ┃
┃  ✧ Commands ✧                 ┃
┃  • on   → Enable forwarding   ┃
┃  • off  → Disable forwarding  ┃
┃  • (no arg) → Show this menu   ┃
┃                               ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

✨ Mickey Glitch is watching all private statuses for you ✨
`.trim();

// Command handler
async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Owner-only command!' }, { quoted: msg });
            return;
        }

        const command = args && typeof args === 'string' ? args.trim().toLowerCase() : '';

        if (command === 'on' || command === 'off') {
            const newState = command === 'on';
            config.forwardToOwner = newState;

            if (saveConfig()) {
                const status = newState ? 'ENABLED ✅' : 'DISABLED ❌';
                const feedback = newState 
                    ? 'Now forwarding all private statuses to you instantly! 🟢' 
                    : 'Status forwarding stopped.';
                await sock.sendMessage(chatId, {
                    text: `✦ *Auto Status Forwarding \( {status}*\n\n \){feedback}`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Failed to save settings!' }, { quoted: msg });
            }
            return;
        }

        // Show menu
        const ownerJid = getOwnerJid(sock);
        const ownerNum = ownerJid ? ownerJid.split('@')[0] : 'Unknown';

        await sock.sendMessage(chatId, {
            text: getStatusMenu(ownerNum, config.forwardToOwner)
        }, { quoted: msg });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Error occurred!' }, { quoted: msg });
    }
}

// Always react with green heart
async function reactToStatus(sock, statusKey) {
    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: statusKey,
                text: '💚'  // Changed to green heart
            }
        }, { messageId: statusKey.id });
    } catch (e) {
        console.error('Reaction failed:', e.message);
    }
}

// Main handler
async function handleStatusUpdate(sock, status) {
    try {
        let message = null;
        let key = null;

        if (status.messages?.length > 0) {
            message = status.messages[0];
            key = message.key;
        } else if (status.key) {
            message = status;
            key = status.key;
        }

        if (!key || key.remoteJid !== 'status@broadcast') return;

        // Always mark as read
        await sock.readMessages([key]).catch(() => {});

        // Always react with green heart
        await reactToStatus(sock, key);

        // Forward if enabled and it's media
        if (message?.message) {
            await forwardStatusToOwner(sock, message);
        }
    } catch (error) {
        console.error('Handler error:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};