const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = {
    enabled: true,              // Always start ON
    reactWith: '💚',            // Default reaction = green heart
    forwardToOwner: true,
    forwardOnlyMedia: true,
    ignoreOwnStatus: true       // Recommended: don't react to your own status
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
        // Force default if file broken
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

loadConfig(); // Load on start (always starts enabled)

// ────────────────────────────────────────────────

function getOwnerJid(sock) {
    const owner =
        require('../settings')?.ownerNumber ||
        process.env.OWNER_NUMBER ||
        process.env.OWNER ||
        sock?.user?.id?.split(':')[0];

    return owner ? `${owner}@s.whatsapp.net` : null;
}

// ────────────────────────────────────────────────
// Very reliable reaction sender (2025-2026 style)
async function reactToStatus(sock, key) {
    if (!config.enabled || !config.reactWith) return;
    if (config.ignoreOwnStatus && key.fromMe) return;

    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: {
                    ...key,
                    remoteJid: 'status@broadcast'
                },
                text: config.reactWith,
                senderTimestampMs: Date.now(),
                // Some newer versions require this field
                reactionTimestampMs: Date.now()
            }
        }, {
            messageId: key.id || Date.now().toString()
        });

        console.log(`[AutoStatus] Reacted ${config.reactWith} to status from ${key.participant || key.remoteJid}`);
    } catch (err) {
        console.log('[AutoStatus] Reaction failed:', err.message?.slice(0, 120));
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
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

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
            config.reactWith = reactArg.trim().slice(0, 4);
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

    // Show menu by default
    const ownerNum = getOwnerJid(sock)?.split('@')[0] || '—';
    return sock.sendMessage(chatId, { text: getStatusMenu(ownerNum) }, { quoted: m });
}

// ────────────────────────────────────────────────
// Main status handler - always reacts when enabled
async function handleStatusUpdate(sock, status) {
    try {
        if (!status?.messages?.length && !status?.key) return;

        const m = status.messages?.[0] || status;
        const key = m.key;

        if (key.remoteJid !== 'status@broadcast') return;

        // Mark as read (helps avoid "viewed" issues sometimes)
        await sock.readMessages([key]).catch(() => {});

        // Always try to react when module is enabled
        await reactToStatus(sock, key);

        // Optional forwarding (your existing logic)
        if (config.enabled && config.forwardToOwner) {
            // ... your forwardStatusToOwner() function here ...
            // (keep your previous forwarding code)
        }

    } catch (err) {
        console.error('[AutoStatus] Main handler error:', err.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};
