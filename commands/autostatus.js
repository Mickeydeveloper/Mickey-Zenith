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
    reactWith: '🤍',           // ← now configurable
    randomDelayMinMs: 900,
    randomDelayMaxMs: 2600,
});

/** @type {typeof DEFAULT_CONFIG} */
let configCache = null;

// ────────────────────────────────────────────────
/**
 * @returns {Promise<typeof DEFAULT_CONFIG>}
 */
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(data);
        configCache = { ...DEFAULT_CONFIG, ...parsed };
        return configCache;
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('[AutoStatus] Config load error → using defaults', err.message);
        }
        configCache = { ...DEFAULT_CONFIG };
        await saveConfig(configCache);
        return configCache;
    }
}

/**
 * @param {Partial<typeof DEFAULT_CONFIG>} newConfig
 */
async function saveConfig(newConfig) {
    configCache = { ...configCache, ...newConfig };
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configCache, null, 2));
    } catch (err) {
        console.error('[AutoStatus] Cannot save config', err.message);
    }
}

// ────────────────────────────────────────────────
/**
 * Extract clean phone number from any JID / key format
 * @param {any} key
 * @returns {string}
 */
function extractPhoneNumber(key) {
    if (!key) return '???';

    const jid = key.participant || key.remoteJid || '';
    if (typeof jid !== 'string') return '???';

    // Most common case
    const match = jid.match(/^(\d{9,15})(?::|@)/);
    if (match) return match[1];

    // Fallback
    const atPos = jid.indexOf('@');
    if (atPos > 3) return jid.slice(0, atPos);

    return '???';
}

// ────────────────────────────────────────────────
async function forwardStatus(sock, msg) {
    if (!msg?.message) return;

    const phone = extractPhoneNumber(msg.key);
    const msgType = Object.keys(msg.message)[0] ?? 'unknown';
    const content = msg.message[msgType] ?? {};

    const timeStr = new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Dar_es_Salaam',
        dateStyle: 'short',
        timeStyle: 'medium'
    });

    console.debug(`[Status] ${phone} • ${msgType} • ${timeStr}`);

    // ─── Text only ───────────────────────────────────────
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = content.text || content.description || '[empty text status]';
        await sock.sendMessage(TARGET_JID, {
            text: `📸 *Status*  \( {phone}\n\n \){text}\n\n🕒 ${timeStr}`
        }).catch(e => console.debug('[AutoStatus:text] failed', e.message));
        return;
    }

    // ─── Supported media types ───────────────────────────
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
            text: `📊 New status type from ${phone}\n• ${msgType}\n• ${timeStr}`
        }).catch(() => {});
        return;
    }

    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        const caption = content.caption ? `Caption: ${content.caption}\n` : '';
        const filename = content.fileName || `status-\( {Date.now()}. \){handler.ext}`;

        await sock.sendMessage(TARGET_JID, {
            [handler.type]: buffer,
            mimetype: content.mimetype || handler.mime,
            fileName: filename,
            caption: `👤 \( {phone}\n \){caption}🕒 ${timeStr}`
        });

        console.debug(`[AutoStatus] forwarded ${handler.type} ← ${phone}`);
    } catch (err) {
        console.error('[AutoStatus:media]', err.message || err);

        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Failed to forward status media from ${phone}\n` +
                  `Type: ${msgType}\n` +
                  `Caption: ${content.caption || '—'}\n` +
                  `Time: ${timeStr}`
        }).catch(() => {});
    }
}

// ────────────────────────────────────────────────
async function reactToStatus(sock, key) {
    const cfg = await loadConfig();
    if (!cfg.reactWith) return;

    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: {
                    remoteJid: 'status@broadcast',
                    fromMe: false,
                    id: key.id,
                    participant: key.participant || undefined
                },
                text: cfg.reactWith,
                isBigEmoji: true
            }
        }, { messageId: key.id });
    } catch {
        // silent fail — very common with reactions
    }
}

// ────────────────────────────────────────────────
/** @param {number} min @param {number} max */
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    const cfg = await loadConfig();
    if (!cfg.enabled) return;

    let msgKey;

    if (ev.messages?.length > 0) {
        msgKey = ev.messages[0].key;
    } else if (ev.key?.remoteJid === 'status@broadcast') {
        msgKey = ev.key;
    } else if (ev.reaction?.key?.remoteJid === 'status@broadcast') {
        msgKey = ev.reaction.key;
    } else {
        return;
    }

    if (!msgKey?.remoteJid?.includes('status@broadcast')) return;

    try {
        // Mark as read (helps avoid "seen" issues in some clients)
        await sock.readMessages([msgKey]).catch(() => {});

        // Random delay → looks more human
        await new Promise(r => setTimeout(r, randomDelay(cfg.randomDelayMinMs, cfg.randomDelayMaxMs)));

        // React first (usually faster)
        await reactToStatus(sock, msgKey);

        // Then forward (heavier operation)
        const msg = ev.messages?.[0] || ev;
        await forwardStatus(sock, msg);

    } catch (err) {
        console.error('[AutoStatus] handler crash', err?.message || err);
    }
}

// ────────────────────────────────────────────────
async function autoStatusCommand(sock, chatId, msg, args = []) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAllowed = msg.key.fromMe || (await isOwnerOrSudo(sender, sock, chatId));

    if (!isAllowed) {
        return sock.sendMessage(chatId, { text: '⛔ Owner only command' });
    }

    const cfg = await loadConfig();

    if (args.length === 0) {
        const emoji = v => v ? '🟢 ON' : '🔴 OFF';
        return sock.sendMessage(chatId, {
            text:
`🔄 *Auto Status Forwarder*

Status forwarding : ${emoji(cfg.enabled)}
Auto reaction      : \( {emoji(!!cfg.reactWith)} ( \){cfg.reactWith || '—'})
Target number      : ${TARGET_NUMBER}

Commands:
  .autostatus on / off
  .autostatus react 🤍 / off
  .autostatus status`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'on') {
        await saveConfig({ enabled: true });
        return sock.sendMessage(chatId, { text: '✅ Auto-status **enabled**' });
    }

    if (cmd === 'off') {
        await saveConfig({ enabled: false });
        return sock.sendMessage(chatId, { text: '⛔ Auto-status **disabled**' });
    }

    if (cmd === 'react') {
        if (args.length < 2) {
            return sock.sendMessage(chatId, {
                text: 'Use:\n.autostatus react ❤️\n.autostatus react off'
            });
        }

        const emoji = args[1].trim();
        const newReact = (emoji.length <= 2 && emoji !== 'off') ? emoji : null;

        await saveConfig({ reactWith: newReact });
        return sock.sendMessage(chatId, {
            text: newReact
                ? `Reaction changed to → ${newReact}`
                : 'Auto-reaction **turned off**'
        });
    }

    if (cmd === 'status') {
        return sock.sendMessage(chatId, {
            text: `Current config:\n${JSON.stringify(cfg, null, 2)}`
        });
    }

    return sock.sendMessage(chatId, { text: 'Unknown subcommand. Use .autostatus for help.' });
}

// ────────────────────────────────────────────────
module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};