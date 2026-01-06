
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
const settings = require('../settings');
function getOwnerJid(sock) {
    const ownerNumber = settings.ownerNumber || process.env.OWNER_NUMBER || null;
    if (ownerNumber) return `${ownerNumber}@s.whatsapp.net`;
    // Fallback to the current socket's user id if nothing configured
    return sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
}

// Improved: Better detection of original sender in forwarded statuses
async function getOriginalSenderInfo(sock, message) {
    let senderJid = message.key.participant || message.key.remoteJid || '';
    let senderNumber = typeof senderJid === 'string' ? senderJid.split('@')[0] : '';

    let originalNumber = null;

    const ctx = message.message?.imageMessage?.contextInfo ||
                message.message?.videoMessage?.contextInfo ||
                message.message?.extendedTextMessage?.contextInfo ||
                message.contextInfo;

    if (ctx) {
        // If context contains participant (common when forwarded from group), prefer that
        if (ctx.participant) originalNumber = ctx.participant.split('@')[0];

        // Quoted forwarded message (some clients embed original msg in quotedMessage)
        if (!originalNumber && ctx.quotedMessage?.key?.participant) {
            originalNumber = ctx.quotedMessage.key.participant.split('@')[0];
        } else if (!originalNumber && ctx.quotedMessage?.key?.remoteJid) {
            originalNumber = ctx.quotedMessage.key.remoteJid.split('@')[0];
        }

        // Fallback to forwarded metadata
        if (!originalNumber && (ctx.isForwarded || (ctx.forwardingScore || 0) > 0) && ctx.forwardingScore !== undefined) {
            // Some clients set forwarded info without participant; use sender as best-effort
            originalNumber = senderNumber;
        }
    }

    // Final fallback
    if (!originalNumber) originalNumber = senderNumber;

    // Resolve display name (using socket helper if available)
    let displayName = originalNumber;
    let isVerified = '';
    try {
        if (typeof sock.getName === 'function') {
            const name = await sock.getName(originalNumber + '@s.whatsapp.net');
            if (name) displayName = name;
        }
    } catch (e) {}

    // Mark forwarded when original differs from immediate sender
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
            fromLine = `${senderInfo.displayName} (${senderInfo.number})\n↪ Forwarded from: ${senderInfo.directSenderNumber}`;
        } else {
            fromLine = `${senderInfo.displayName} (${senderInfo.number})`;
        }

        const caption = `🟢 New Private Status\n👤 From: ${fromLine}${senderInfo.isVerified || ''}\n🕓 Time: ${date} ${time}`;

        // Send a small summary text, then forward the media for clarity
        try {
            await sock.sendMessage(ownerJid, { text: caption });
            await sock.sendMessage(ownerJid, { forward: message });
        } catch (e) {
            // If forward fails, fallback to forwarding raw message
            try { await sock.sendMessage(ownerJid, { forward: message }); } catch (e2) { console.error('Forward fallback failed:', e2 && e2.message ? e2.message : e2); }
        }

        console.log(`Forwarded status from ${senderInfo.number} (display: ${senderInfo.displayName}) ${senderInfo.isForwarded ? '[forwarded]' : ''}`);
    } catch (error) {
        console.error('Forward error:', error.message);
    }
}

// Updated Menu with green heart and correct info
const getStatusMenu = (targetNum, cfg) => `
╭━━━━━━━━✦ Auto Status ✦━━━━━━━━╮
┃                               ┃
┃  📱 Module  : ${cfg.enabled ? '✅ ENABLED' : '❌ DISABLED'}        ┃
┃  💚 React   : ${cfg.reactOn ? '✅ ENABLED' : '❌ DISABLED'}        ┃
┃  ➡️ Forward : ${cfg.forwardToOwner ? '✅ ENABLED' : '❌ DISABLED'}  ┃
┃  👤 Target  : ${targetNum}     ┃
┃                               ┃
┃  ✧ Commands ✧                 ┃
┃  • enable         → Enable module   ┃
┃  • disable        → Disable module  ┃
┃  • forward on/off → Enable/Disable forward   ┃
┃  • react on/off   → Enable/Disable reaction  ┃
┃  • (no arg)       → Show this menu   ┃
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

        // Enable/disable entire module
        if (['enable', 'disable'].includes(command)) {
            const newState = command === 'enable';
            config.enabled = newState;
            if (saveConfig()) {
                await sock.sendMessage(chatId, { text: `✦ Auto Status module is now ${newState ? 'ENABLED ✅' : 'DISABLED ❌'}` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Failed to save settings!' }, { quoted: msg });
            }
            return;
        }

        // forward on/off
        if (command.startsWith('forward')) {
            const parts = command.split(/\s+/);
            const action = parts[1];
            if (action === 'on' || action === 'off') {
                const newState = action === 'on';
                config.forwardToOwner = newState;
                if (saveConfig()) {
                    await sock.sendMessage(chatId, { text: `✦ Forwarding is now ${newState ? 'ENABLED ✅' : 'DISABLED ❌'}` }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: '❌ Failed to save settings!' }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(chatId, { text: 'Usage: forward on | forward off' }, { quoted: msg });
            }
            return;
        }

        // react on/off
        if (command.startsWith('react')) {
            const parts = command.split(/\s+/);
            const action = parts[1];
            if (action === 'on' || action === 'off') {
                const newState = action === 'on';
                config.reactOn = newState;
                if (saveConfig()) {
                    await sock.sendMessage(chatId, { text: `✦ Reaction is now ${newState ? 'ENABLED ✅' : 'DISABLED ❌'}` }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: '❌ Failed to save settings!' }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(chatId, { text: 'Usage: react on | react off' }, { quoted: msg });
            }
            return;
        }

        // Show menu
        const ownerJid = getOwnerJid(sock);
        const ownerNum = ownerJid ? ownerJid.split('@')[0] : 'Unknown';

        await sock.sendMessage(chatId, {
            text: getStatusMenu(ownerNum, config)
        }, { quoted: msg });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Error occurred!' }, { quoted: msg });
    }
}

// Always react with green heart (if enabled)
async function reactToStatus(sock, statusKey) {
    try {
        if (!config.reactOn) return;
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: statusKey,
                text: '💚'  // Green heart
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

        // Always react with green heart (if module enabled)
        if (config.enabled) await reactToStatus(sock, key);

        // Forward if enabled, module enabled, and it's media
        if (config.enabled && config.forwardToOwner && (message?.message?.imageMessage || message?.message?.videoMessage)) {
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