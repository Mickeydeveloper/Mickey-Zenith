const { setAntileft, getAntileft, removeAntileft } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntileftCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```⛔ Only group admins can use this command```' }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(/\s+/);
        const action = args[0];

        if (!action) {
            const usage = `\`\`\`ANTILEFT SETUP\n\n${prefix}antileft on\n${prefix}antileft off\n${prefix}antileft status\n\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existing = await getAntileft(chatId, 'on');
                if (existing && existing.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antileft is already ON_*' }, { quoted: message });
                    return;
                }
                await setAntileft(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_✅ Antileft is now ON — members who leave will be re-added automatically._*' }, { quoted: message });
                break;

            case 'off':
                await removeAntileft(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_🔇 Antileft has been turned OFF_*' }, { quoted: message });
                break;

            case 'status':
            case 'get':
                const status = await getAntileft(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `*_Antileft Status:_* ${status && status.enabled ? 'ON' : 'OFF'}`
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antileft for usage._*` });
        }
    } catch (error) {
        console.error('Error in antileft command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antileft command_*' });
    }
}

module.exports = handleAntileftCommand;
