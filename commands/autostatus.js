const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { generateForwardMessageContent, generateWAMessageFromContent, generateMessageID } = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = {
    enabled: true,
    reactWith: '💚',
    forwardToOwner: true,
    forwardOnlyMedia: true,
    ignoreOwnStatus: true
};

let config = { ...DEFAULT_CONFIG };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        } else {
            fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
        }
    } catch (err) {
        console.error('AutoStatus config error:', err.message);
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save autoStatus config:', err.message);
        return false;
    }
}

loadConfig();

// ────────────────────────────────────────────────

function getOwnerJid(sock) {
    const owner =
        require('../settings')?.ownerNumber ||
        process.env.OWNER_NUMBER ||
        process.env.OWNER ||
        sock?.user?.id?.split(':')[0] ||
        null;

    return owner ? `${owner}@s.whatsapp.net` : null;
}

// ────────────────────────────────────────────────
// Modern & safe reaction sender
async function reactToStatus(sock, originalKey) {
    if (!config.enabled || !config.reactWith) return;
    if (!originalKey) return;

    // Prevent reacting to own status if configured
    if (config.ignoreOwnStatus && originalKey.fromMe) return;

    try {
        const reactionKey = {
            remoteJid: originalKey.remoteJid || 'status@broadcast',
            fromMe: false,
            id: originalKey.id
        };

        // Only include participant when available (important for status broadcasts)
        if (originalKey.participant) reactionKey.participant = originalKey.participant;

        await sock.sendMessage(reactionKey.remoteJid, {
            react: {
                text: config.reactWith,
                key: reactionKey
            }
        });

        console.log(`[AutoStatus] Reacted ${config.reactWith} to ${originalKey.participant || 'unknown'}`);
    } catch (err) {
        console.error('[AutoStatus] Reaction failed:', err?.message || err);
    }
}

// ────────────────────────────────────────────────

const getStatusMenu = (ownerNum) => `
╭──── ✦ Auto Status ✦ ────╮
│                           │
│  Status    : ${config.enabled ? '🟢 ALWAYS ON' : '🔴 OFF'} 
│  Reaction  : ${config.reactWith ? `🟢 ${config.reactWith}` : '🔴 OFF'}
│  Forward   : ${config.forwardToOwner ? '🟢 ON' : '🔴 OFF'} 
│  Owner     : ${ownerNum || '—'}
│                           │
│  Commands:                │
│  • off                    → Turn off completely
│  • on                     → Turn back on
│  • react 💚 / react ❤️    → Change reaction
│  • react off              → Disable reaction
│  • forward on/off         → Forward toggle
│  • status                 → Show this menu
│                           │
╰───────────────────────────╯
`.trim();

async function autoStatusCommand(sock, m, args = '') {
    const chatId = m.key?.remoteJid;
    if (!chatId) return;

    const sender = m.key?.participant || chatId;

    if (!(await isOwnerOrSudo(sender, sock, chatId))) {
        return sock.sendMessage(chatId, { text: '⛔ Owner only!' }, { quoted: m });
    }

    const cmd = (args || '').trim().toLowerCase();

    if (cmd === 'off') {
        config.enabled = false;
        saveConfig();
        return sock.sendMessage(chatId, { text: '✦ Auto Status → 🔴 TURNED OFF' }, { quoted: m });
    }

    if (cmd === 'on') {
        config.enabled = true;
        saveConfig();
        return sock.sendMessage(chatId, { text: '✦ Auto Status → 🟢 ALWAYS ON' }, { quoted: m });
    }

    if (cmd.startsWith('react')) {
        const reactArg = cmd.replace('react', '').trim();
        if (reactArg === 'off') {
            config.reactWith = null;
        } else if (reactArg) {
            config.reactWith = reactArg.trim().slice(0, 4); // emoji usually ≤4 chars
        } else {
            config.reactWith = '💚';
        }

        saveConfig();
        const statusText = config.reactWith ? `Reaction set to: ${config.reactWith}` : 'Reaction → OFF';
        return sock.sendMessage(chatId, { text: statusText }, { quoted: m });
    }

    if (cmd.includes('forward')) {
        config.forwardToOwner = !cmd.includes('off');
        saveConfig();
        return sock.sendMessage(chatId, {
            text: `Forward to owner → ${config.forwardToOwner ? '🟢 ON' : '🔴 OFF'}`
        }, { quoted: m });
    }

    // Default: show menu
    const ownerNum = getOwnerJid(sock)?.split('@')[0] || '—';
    return sock.sendMessage(chatId, { text: getStatusMenu(ownerNum) }, { quoted: m });
}

// ────────────────────────────────────────────────
// Main status handler – much safer parsing
async function handleStatusUpdate(sock, update) {
    try {
        // Bail out early if no useful data
        if (!update || typeof update !== 'object') return;

        let messageObj = null;
        let key = null;

        // Try different shapes Baileys uses for status updates
        if (update.messages?.length > 0) {
            messageObj = update.messages[0];
        } else if (update.message) {
            messageObj = update;
        } else if (update.key) {
            // Some events pass key directly
            key = update.key;
        }

        if (messageObj?.key) {
            key = messageObj.key;
        }

        if (!key?.remoteJid) return; // no valid key → skip

        if (key.remoteJid !== 'status@broadcast') return;

        // Optional: mark as read
        await sock.readMessages([key]).catch(() => {});

        // React!
        await reactToStatus(sock, key);

        // Forward logic: relay the status to owner (uses Baileys forwarding helpers)
        if (config.enabled && config.forwardToOwner) {
            try {
                const owner = getOwnerJid(sock);
                if (!owner) return;

                // Optionally only forward media statuses
                if (config.forwardOnlyMedia) {
                    const msg = messageObj?.message || {};
                    const hasMedia = Boolean(msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.stickerMessage || msg.documentMessage);
                    if (!hasMedia) return;
                }

                // Construct a pseudo-original message for forwarding
                const originalMsg = {
                    key: {
                        remoteJid: key.remoteJid,
                        fromMe: false,
                        id: key.id,
                        participant: key.participant
                    },
                    message: messageObj?.message || {}
                };

                const forwardContent = generateForwardMessageContent(originalMsg);
                const waMessage = generateWAMessageFromContent(owner, forwardContent, {});

                // add forwarded metadata for clarity
                waMessage.message = waMessage.message || {};
                waMessage.message.contextInfo = waMessage.message.contextInfo || {};
                waMessage.message.contextInfo.isForwarded = true;
                waMessage.message.contextInfo.forwardingScore = waMessage.message.contextInfo.forwardingScore || 999;

                await sock.relayMessage(owner, waMessage.message, { messageId: waMessage.key.id });
                console.log(`[AutoStatus] Forwarded status ${key.id} to owner ${owner}`);
            } catch (fwdErr) {
                console.error('[AutoStatus] Forward failed:', fwdErr?.message || fwdErr);
            }
        }

    } catch (err) {
        console.error('[AutoStatus] Handler error:', err?.message || err);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};