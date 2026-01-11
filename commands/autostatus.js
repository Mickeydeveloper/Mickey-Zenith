const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = {
    enabled: true,
    reactWith: '💚',
    forwardToOwner: true,
    forwardOnlyMedia: true,
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
        console.error('AutoStatus config load/create failed:', err.message);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error('AutoStatus config save failed:', err.message);
        return false;
    }
}

loadConfig();

// Get owner JID
function getOwnerJid(sock) {
    const owner =
        require('../settings')?.ownerNumber ||
        process.env.OWNER_NUMBER ||
        process.env.OWNER ||
        sock?.user?.id?.split(':')[0];

    return owner ? `${owner}@s.whatsapp.net` : null;
}

// Improved sender detection - tries many contextInfo locations
async function getBestSenderInfo(sock, m) {
    if (!m) return { number: 'unknown', name: 'Unknown', isForwarded: false, forwardedBy: null };

    const msg = m.message || {};
    const ci = msg.imageMessage?.contextInfo ||
               msg.videoMessage?.contextInfo ||
               msg.extendedTextMessage?.contextInfo ||
               m.messageStubParameters?.[0]?.contextInfo || // rare cases
               m.contextInfo || {};

    let originalJid = null;
    let forwardedByJid = null;

    // 2025–2026 common patterns
    if (ci.participant) {
        originalJid = ci.participant;
    }
    if (ci.remoteJid && ci.remoteJid.includes('@s.whatsapp.net') && !originalJid) {
        originalJid = ci.remoteJid;
    }
    // Sometimes forwarded info is nested deeper
    if (ci.quotedMessage?.contextInfo?.participant) {
        originalJid = ci.quotedMessage.contextInfo.participant;
    }
    // Forwarded-by chain (who sent it to you)
    if (ci.forwardingScore > 0 && ci.participant) {
        forwardedByJid = ci.participant; // usually the person who forwarded it to your status view
        if (!originalJid) originalJid = ci.participant;
    }

    const directJid = m.key?.participant || m.key?.remoteJid || 'unknown';
    const directNumber = directJid.split('@')[0];

    if (!originalJid) originalJid = directJid;

    const originalNumber = originalJid.split('@')[0];
    const isForwarded = originalNumber !== directNumber;

    let displayName = originalNumber;
    try {
        if (sock?.profilePictureUrl || sock?.getName) {
            const name = await sock.getName?.(originalJid) || originalNumber;
            if (name && name !== originalNumber) displayName = name;
        }
    } catch {}

    let forwardedByName = null;
    if (forwardedByJid && forwardedByJid !== originalJid) {
        try {
            forwardedByName = await sock.getName?.(forwardedByJid) || forwardedByJid.split('@')[0];
        } catch {}
    }

    return {
        number: originalNumber,
        name: displayName,
        directNumber,
        isForwarded,
        forwardedBy: forwardedByName || (forwardedByJid ? forwardedByJid.split('@')[0] : null),
        jid: originalJid
    };
}

// Forward with rich sender info in caption
async function forwardStatusToOwner(sock, m) {
    if (!config.forwardToOwner) return;
    if (config.forwardOnlyMedia && !m.message?.imageMessage && !m.message?.videoMessage) return;

    const ownerJid = getOwnerJid(sock);
    if (!ownerJid) return;

    const sender = await getBestSenderInfo(sock, m);

    const timeStr = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    let fromText = `👤 **\( {sender.name}** ( \){sender.number})`;

    if (sender.isForwarded && sender.forwardedBy) {
        fromText += `\n↳ Forwarded by: ${sender.forwardedBy}`;
    } else if (sender.isForwarded) {
        fromText += `\n↳ Forwarded status`;
    }

    const caption = `🟢 New Status Update\n${fromText}\n🕒 ${timeStr}\n\n──────────────`;

    try {
        // 1. Send informative caption first
        await sock.sendMessage(ownerJid, { text: caption });

        // 2. Then forward the original media (preserves quality/best compatibility)
        await sock.sendMessage(ownerJid, { forward: m.key });
    } catch (e) {
        console.log('[AutoStatus] Forward failed → trying copyNForward fallback');
        try {
            await sock.copyNForward(ownerJid, m, true, { caption });
        } catch (e2) {
            console.error('[AutoStatus] Both forwarding methods failed:', e2.message);
        }
    }

    console.log(`[AutoStatus] Forwarded → \( {sender.name} ( \){sender.number})${sender.isForwarded ? ' [forwarded]' : ''}`);
}

// ────────────────────────────────────────────────

const getStatusMenu = (ownerNum) => `
╭── ✦ Auto Status Control ✦ ──╮
│                               │
│  Module    : ${config.enabled ? '🟢 ON' : '🔴 OFF'} 
│  Reaction  : ${config.reactWith ? `🟢 ${config.reactWith}` : '🔴 OFF'}
│  Forward   : ${config.forwardToOwner ? '🟢 ON' : '🔴 OFF'} 
│  Owner     : ${ownerNum || '—'}
│                               │
│  Commands:                    │
│  • on / off                   │
│  • react 💚 / react off       │
│  • forward on / forward off   │
│  • status                     │
│                               │
╰───────────────────────────────╯
`.trim();

async function autoStatusCommand(sock, m, args = '') {
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;

    if (!(await isOwnerOrSudo(sender, sock, chatId))) {
        await sock.sendMessage(chatId, { text: '⛔ Owner only!' }, { quoted: m });
        return;
    }

    const cmd = args.trim().toLowerCase();

    if (cmd === 'on' || cmd === 'off') {
        config.enabled = cmd === 'on';
        saveConfig();
        await sock.sendMessage(chatId, { text: `Module → ${config.enabled ? '🟢 ON' : '🔴 OFF'}` }, { quoted: m });
        return;
    }

    if (cmd.startsWith('react')) {
        const reactArg = cmd.replace('react', '').trim();
        if (reactArg === 'off') config.reactWith = null;
        else if (reactArg) config.reactWith = reactArg.slice(0, 4); // allow longer emojis if needed
        else config.reactWith = '💚';

        saveConfig();
        const status = config.reactWith ? `🟢 ${config.reactWith}` : '🔴 OFF';
        await sock.sendMessage(chatId, { text: `Reaction → ${status}` }, { quoted: m });
        return;
    }

    if (cmd.includes('forward')) {
        config.forwardToOwner = !cmd.includes('off');
        saveConfig();
        await sock.sendMessage(chatId, {
            text: `Forward to owner → ${config.forwardToOwner ? '🟢 ON' : '🔴 OFF'}`
        }, { quoted: m });
        return;
    }

    const ownerNum = getOwnerJid(sock)?.split('@')[0] || '—';
    await sock.sendMessage(chatId, { text: getStatusMenu(ownerNum) }, { quoted: m });
}

// ────────────────────────────────────────────────

async function reactToStatus(sock, key) {
    if (!config.enabled || !config.reactWith) return;

    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key,
                text: config.reactWith,
                senderTimestampMs: Date.now()
            }
        }, { messageId: key.id });
    } catch (e) {
        console.log('[AutoStatus] Reaction failed:', e.message);
    }
}

async function handleStatusUpdate(sock, status) {
    try {
        if (!status?.messages?.length && !status?.key) return;

        const m = status.messages?.[0] || status;
        const key = m.key;

        if (key.remoteJid !== 'status@broadcast') return;

        await sock.readMessages([key]).catch(() => {});

        await reactToStatus(sock, key);

        if (config.enabled && config.forwardToOwner) {
            await forwardStatusToOwner(sock, m);
        }
    } catch (err) {
        console.error('[AutoStatus] Handler error:', err.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};
