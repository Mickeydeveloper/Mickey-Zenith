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
            if (res.available) {
                await sock.sendMessage(chatId, { text: 'Update available.' }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: 'No updates available.' }, { quoted: message });
            }
            return;
        }

        if (res.mode === 'zip') {
            if (res.available) {
                await sock.sendMessage(chatId, { text: 'Update available.' }, { quoted: message });
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
