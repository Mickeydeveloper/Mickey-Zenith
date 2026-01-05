const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const dataPath = path.join(__dirname, '../data/userGroupData.json');

async function readUserGroupData() {
    try {
        if (!fs.existsSync(dataPath)) {
            await fs.promises.mkdir(path.dirname(dataPath), { recursive: true });
            const defaultData = { antileft: {} };
            await fs.promises.writeFile(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const raw = await fs.promises.readFile(dataPath, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (error) {
        console.error('readUserGroupData error:', error);
        return { antileft: {} };
    }
}

async function writeUserGroupData(data) {
    try {
        await fs.promises.mkdir(path.dirname(dataPath), { recursive: true });
        await fs.promises.writeFile(dataPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('writeUserGroupData error:', error);
        return false;
    }
}

async function setAntileft(groupId, type) {
    try {
        const data = await readUserGroupData();
        if (!data.antileft) data.antileft = {};
        data.antileft[groupId] = { enabled: type === 'on' };
        await writeUserGroupData(data);
        return true;
    } catch (error) {
        console.error('setAntileft error:', error);
        return false;
    }
}

async function getAntileft(groupId, type) {
    try {
        const data = await readUserGroupData();
        if (!data.antileft || !data.antileft[groupId]) return null;
        return type === 'on' ? data.antileft[groupId] : null;
    } catch (error) {
        console.error('getAntileft error:', error);
        return null;
    }
}

async function removeAntileft(groupId, type) {
    try {
        const data = await readUserGroupData();
        if (data.antileft && data.antileft[groupId]) {
            delete data.antileft[groupId];
            await writeUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('removeAntileft error:', error);
        return false;
    }
}

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
