const updateCommand = require('./update');
const isOwnerOrSudo = require('../lib/isOwner');

async function checkUpdatesCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: 'Only bot owner or sudo can use .checkupdates' }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { text: '🔎 Checking for updates…' }, { quoted: message });
        const res = await updateCommand.checkUpdates();
        if (!res || res.mode === 'none') {
            await sock.sendMessage(chatId, { text: 'ℹ️ No update method configured (no git repo and no ZIP URL).' }, { quoted: message });
            return;
        }

        if (res.mode === 'git') {
            if (!res.available) {
                await sock.sendMessage(chatId, { text: `✅ No updates available. Current revision: ${res.oldRev}` }, { quoted: message });
                return;
            }
            // Prepare commit/file summary (trim long lists)
            const commitList = res.commits ? res.commits.split('\n').slice(0, 30).join('\n') : 'No commit info';
            const fileList = res.files ? res.files.split('\n').slice(0, 60).join('\n') : 'No file list';
            const msg = `⚠️ Updates available!\nFrom: ${res.oldRev}\nTo: ${res.newRev}\n\n*Commits:*\n${commitList}\n\n*Files changed:*\n${fileList}`;
            await sock.sendMessage(chatId, { text: msg }, { quoted: message });
            return;
        }

        if (res.mode === 'zip') {
            const prev = res.previous;
            const meta = res.remoteMeta;
            if (res.available && prev) {
                const parts = [];
                parts.push(`⚠️ ZIP update detected at ${meta.url}`);
                if (prev.etag !== meta.etag) parts.push(`• ETag changed: ${prev.etag || 'none'} → ${meta.etag || 'none'}`);
                if (prev.lastModified !== meta.lastModified) parts.push(`• Last-Modified: ${prev.lastModified || 'none'} → ${meta.lastModified || 'none'}`);
                if (prev.size !== meta.size) parts.push(`• Size: ${prev.size || 'unknown'} → ${meta.size || 'unknown'} bytes`);
                await sock.sendMessage(chatId, { text: parts.join('\n') }, { quoted: message });
                return;
            } else if (res.available && !prev) {
                await sock.sendMessage(chatId, { text: `⚠️ ZIP update metadata recorded for ${meta.url}. Next run will be able to detect changes.` }, { quoted: message });
                return;
            } else {
                await sock.sendMessage(chatId, { text: `✅ No ZIP update available. URL: ${meta.url}\nLast-Modified: ${meta.lastModified || 'unknown'}` }, { quoted: message });
                return;
            }
        }

    } catch (err) {
        console.error('CheckUpdates failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Check failed: ${String(err.message || err).slice(0, 300)}` }, { quoted: message });
    }
}

module.exports = checkUpdatesCommand;
