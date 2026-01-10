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
                await sock.sendMessage(chatId, { text: `✅ No updates available — current revision: ${res.oldRev}` }, { quoted: message });
                return;
            }

            // Parse changed files and filter for commands/ and index.js
            const allFiles = res.files ? res.files.split('\n').map(f => f.trim()).filter(Boolean) : [];
            const relevant = allFiles.filter(f => f.startsWith('commands/') || f === 'index.js' || f.endsWith('/index.js') || f.includes('/index.js'));

            let msg = '';
            if (relevant.length === 0) {
                msg = `⚠️ *Update available!*\n_No changes detected in *commands/* or *index.js._\nTotal files changed: ${allFiles.length || 'unknown'}\n\nUse *.update* to apply updates.`;
            } else {
                const maxShow = 30;
                const shown = relevant.slice(0, maxShow);
                const more = relevant.length - shown.length;
                msg = `⚠️ *Update available!*\n*Files changed in commands/index:* (${relevant.length})\n${shown.map(f => `• ${f}`).join('\n')}${more > 0 ? `\n...and ${more} more` : ''}\n\nUse *.update* to apply changes.`;
            }

            await sock.sendMessage(chatId, { text: msg }, { quoted: message });
            return;
        }

        if (res.mode === 'zip') {
            const prev = res.previous;
            const meta = res.remoteMeta;

            if (res.available && prev) {
                // If we can inspect changes, gather file lists
                if (res.changes) {
                    const { added = [], removed = [], modified = [] } = res.changes;
                    const all = [...added, ...removed, ...modified].map(f => f.trim()).filter(Boolean);
                    const relevant = all.filter(f => f.startsWith('commands/') || f === 'index.js' || f.endsWith('/index.js') || f.includes('/index.js'));

                    let msg = '';
                    if (relevant.length === 0) {
                        msg = `⚠️ *ZIP update available!*\n_No changes detected in *commands/* or *index.js._\nFiles changed: ${all.length}\n\nUse *.update* to apply changes.`;
                    } else {
                        const maxShow = 30;
                        const shown = relevant.slice(0, maxShow);
                        const more = relevant.length - shown.length;
                        msg = `⚠️ *ZIP update available!*\n*Files changed in commands/index:* (${relevant.length})\n${shown.map(f => `• ${f}`).join('\n')}${more > 0 ? `\n...and ${more} more` : ''}\n\nUse *.update* to apply changes.`;
                    }

                    await sock.sendMessage(chatId, { text: msg }, { quoted: message });
                    return;
                } else {
                    await sock.sendMessage(chatId, { text: `⚠️ ZIP update available at ${meta.url}, but file-level inspection not available. Use *.update* to apply.` }, { quoted: message });
                    return;
                }
            } else if (res.available && !prev) {
                await sock.sendMessage(chatId, { text: `⚠️ ZIP update detected at ${meta.url}. Metadata recorded; file diff will be available next check.` }, { quoted: message });
                return;
            } else {
                await sock.sendMessage(chatId, { text: `✅ No ZIP update available.` }, { quoted: message });
                return;
            }
        }

    } catch (err) {
        console.error('CheckUpdates failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Check failed: ${String(err.message || err).slice(0, 300)}` }, { quoted: message });
    }
}

module.exports = checkUpdatesCommand;
