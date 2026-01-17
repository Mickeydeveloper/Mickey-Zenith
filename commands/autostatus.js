const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // ← important!

const isOwnerOrSudo = require('../lib/isOwner');

// Paths
const configPath = path.join(__dirname, '../data/autoStatus.json');
const statusSaveDir = path.join(__dirname, '../data/status media'); // optional folder

// Make sure folder exists
if (!fs.existsSync(statusSaveDir)) {
    fs.mkdirSync(statusSaveDir, { recursive: true });
}

const DEFAULT_CONFIG = {
    enabled: true,
    reactOn: true,
    // Forward + download to bot number → always ON
};

if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

function getBotJid(sock) {
    try {
        let jid = sock.user?.id || sock.user?.jid;
        if (!jid) return null;
        return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    } catch {
        return null;
    }
}

async function saveAndSendStatusToBot(sock, m) {
    if (!m.message) return;

    const botJid = getBotJid(sock);
    if (!botJid) {
        console.debug('[AutoStatus] Bot JID not available');
        return;
    }

    const sender = m.key.participant || m.key.remoteJid || 'Unknown';
    const msgType = Object.keys(m.message)[0];
    const mediaMsg = m.message[msgType];

    console.log(`[AutoStatus] Processing status from ${sender} — type: ${msgType}`);

    let caption = mediaMsg.caption || '';
    let fileName = '';
    let mimetype = '';
    let extension = '';

    if (msgType === 'imageMessage') {
        mimetype = mediaMsg.mimetype || 'image/jpeg';
        extension = mimetype.split('/')[1] || 'jpg';
        fileName = `status-img-\( {Date.now()}. \){extension}`;
    } else if (msgType === 'videoMessage') {
        mimetype = mediaMsg.mimetype || 'video/mp4';
        extension = mimetype.split('/')[1] || 'mp4';
        fileName = `status-video-\( {Date.now()}. \){extension}`;
    } else if (msgType === 'audioMessage') {
        mimetype = mediaMsg.mimetype || 'audio/ogg';
        extension = 'ogg';
        fileName = `status-audio-\( {Date.now()}. \){extension}`;
    } else if (msgType === 'documentMessage') {
        mimetype = mediaMsg.mimetype;
        extension = path.extname(mediaMsg.fileName || '') || '.bin';
        fileName = mediaMsg.fileName || `status-doc-\( {Date.now()} \){extension}`;
    } else if (msgType === 'stickerMessage') {
        mimetype = 'image/webp';
        extension = 'webp';
        fileName = `status-sticker-${Date.now()}.webp`;
    } else {
        // Text-only status → just forward text
        await sock.sendMessage(botJid, { text: caption || '[Text status]' });
        console.log('[AutoStatus] Text-only status forwarded');
        return;
    }

    try {
        const buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
            {
                logger: console,
                // Important if media was deleted from servers
                reuploadRequest: sock.updateMediaMessage
            }
        );

        // Optional: save to disk
        const filePath = path.join(statusSaveDir, fileName);
        fs.writeFileSync(filePath, buffer);
        console.log(`[AutoStatus] Media saved → ${filePath}`);

        // Send to your own number
        const sent = await sock.sendMessage(botJid, {
            [msgType.replace('Message', '')]: buffer,
            mimetype,
            fileName: fileName,
            caption: caption
                ? `From: \( {sender.replace('@s.whatsapp.net', '')}\n \){caption}`
                : `Status from ${sender.replace('@s.whatsapp.net', '')}`
        });

        if (sent) {
            console.log('[AutoStatus] ✓ Media sent to bot number');
        }

    } catch (err) {
        console.error('[AutoStatus] Failed to download/send media:', err.message);

        // Fallback — send notification + original proto attempt
        await sock.sendMessage(botJid, {
            text: `⚠️ Status from \( {sender} — media download failed\n \){caption || '[No caption]'}\n\n(Time: ${new Date().toLocaleString()})`
        });

        // Optional last-try forward (usually corrupted)
        try {
            await sock.sendMessage(botJid, m.message);
        } catch {}
    }
}

async function reactToStatus(sock, key) {
    try {
        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        fromMe: false,
                        id: key.id,
                        participant: key.participant
                    },
                    text: '🤍'
                }
            },
            { messageId: key.id }
        );
    } catch (e) {
        if (!e.message?.includes('rate')) {
            console.error('[AutoStatus] React failed:', e.message);
        }
    }
}

function loadConfig() {
    try {
        const data = fs.readFileSync(configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
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

async function autoStatusCommand(sock, chatId, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = await isOwnerOrSudo(sender, sock, chatId);

    if (!msg.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { text: '❌ Owner only command!' });
    }

    let config = loadConfig();

    if (!args.length) {
        const botJid = getBotJid(sock);
        const botNum = botJid ? botJid.split('@')[0] : '—';

        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Status Settings*\n\n` +
                  `📱 View status   : ${config.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                  `💞 Auto react    : ${config.reactOn ? '🟢 ON' : '🔴 OFF'}\n` +
                  `📥 Save to number: 🟢 ON (always)\n` +
                  `   → Bot number: ${botNum}\n\n` +
                  `Commands:\n` +
                  `.autostatus on/off\n` +
                  `.autostatus react on/off`
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
        if (!args[1]) return sock.sendMessage(chatId, { text: 'Use: .autostatus react on/off' });

        const sub = args[1].toLowerCase();
        if (sub === 'on') config.reactOn = true;
        else if (sub === 'off') config.reactOn = false;
        else return sock.sendMessage(chatId, { text: 'Invalid — use on or off' });

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, {
            text: `Status reactions: ${config.reactOn ? '🟢 ON' : '🔴 OFF'}`
        });
    }

    return sock.sendMessage(chatId, { text: 'Invalid command.\nUse .autostatus for help' });
}

async function handleStatusUpdate(sock, ev) {
    if (!isAutoStatusEnabled()) return;

    // Small anti-ban / rate-limit delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

    let m;

    if (ev.messages?.length) {
        m = ev.messages[0];
    } else if (ev.key?.remoteJid === 'status@broadcast') {
        m = ev;
    } else if (ev.reaction?.key?.remoteJid === 'status@broadcast') {
        m = ev.reaction;
    }

    if (!m?.key?.remoteJid?.includes('status@broadcast')) return;

    try {
        await sock.readMessages([m.key]);

        if (isStatusReactionEnabled()) {
            await reactToStatus(sock, m.key);
        }

        // Main action: download media & send to your number
        await saveAndSendStatusToBot(sock, m);

    } catch (err) {
        if (err.message?.includes('rate')) {
            console.log('[AutoStatus] Rate limit — waiting longer next time');
        } else {
            console.error('[AutoStatus] Error:', err.message);
        }
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};