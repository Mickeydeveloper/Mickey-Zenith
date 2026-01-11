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
        const res = await updateCommand.checkUpdates();
        if (!res || res.mode === 'none') {
            await sock.sendMessage(chatId, { text: 'No updates available.' }, { quoted: message });
            return;
        }

        if (res.mode === 'git') {
            const allFiles = res.files ? res.files.split('\n').map(f => f.trim()).filter(Boolean) : [];
            const total = allFiles.length;
            const relevant = allFiles.filter(f => f.startsWith('commands/') || f === 'index.js' || f.endsWith('/index.js') || f.includes('/index.js'));

            if (res.available) {
                const maxShow = 5;
                const shown = relevant.slice(0, maxShow);
                const more = relevant.length - shown.length;
                let details = '';
                if (relevant.length > 0) {
                    details = `; ${relevant.length} in commands/index: ${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}`;
                } else {
                    details = '; no changes in commands/ or index.js';
                }

                await sock.sendMessage(chatId, { text: `Update available — ${total || 'unknown'} files changed${details}.` }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: 'No updates available.' }, { quoted: message });
            }
            return;
        }

        if (res.mode === 'zip') {
            if (res.available) {
                const prev = res.previous;
                const meta = res.remoteMeta;

                if (res.changes) {
                    const { added = [], removed = [], modified = [] } = res.changes;
                    const all = [...added, ...removed, ...modified].map(f => f.trim()).filter(Boolean);
                    const total = all.length;
                    const relevant = all.filter(f => f.startsWith('commands/') || f === 'index.js' || f.endsWith('/index.js') || f.includes('/index.js'));

                    const maxShow = 5;
                    const shown = relevant.slice(0, maxShow);
                    const more = relevant.length - shown.length;
                    let details = '';
                    if (relevant.length > 0) {
                        details = `; ${relevant.length} in commands/index: ${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}`;
                    } else {
                        details = '; no changes in commands/ or index.js';
                    }

                    await sock.sendMessage(chatId, { text: `Update available — ${total} files changed${details}.` }, { quoted: message });
                    return;
                } else if (prev) {
                    await sock.sendMessage(chatId, { text: `Update available — ZIP at ${meta.url} (file details not available yet).` }, { quoted: message });
                    return;
                } else {
                    await sock.sendMessage(chatId, { text: `Update available — ZIP at ${meta.url}.` }, { quoted: message });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, { text: 'No updates available.' }, { quoted: message });
            }
            return;
        }

    } catch (err) {
        console.error('CheckUpdates failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Check failed: ${String(err.message || err).slice(0, 300)}` }, { quoted: message });
    }
}

module.exports = checkUpdatesCommand;
