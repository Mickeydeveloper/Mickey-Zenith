// utils/bugMenu.js
import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

/**
 * Sends the "Bug Menu" as a video message with caption.
 * @param {Object} message  - The incoming Baileys message object.
 * @param {Object} client   - The Baileys client instance.
 */
export async function bugMenu(message, client) {
    try {
        // -----------------------------------------------------------------
        // 1. Extract needed data
        // -----------------------------------------------------------------
        const remoteJid = message?.key?.remoteJid;
        if (!remoteJid) throw new Error('remoteJid not found');

        const today = new Date();
        const daysOfWeek = [
            'Sunday', 'Monday', 'Tuesday', 'Wednesday',
            'Thursday', 'Friday', 'Saturday'
        ];
        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const botNumber = client?.user?.id?.split(':')[0] ?? 'Unknown';
        const username = message?.pushName ?? 'Unknown';
        const prefix = configManager?.config?.users?.[botNumber]?.prefix ?? '!';

        // -----------------------------------------------------------------
        // 2. Build the caption (exactly as you had it)
        // -----------------------------------------------------------------
        const caption = `
╭────────────────╮
    ༒ ${BOT_NAME} ༒
╰────────────────╯
╭────────────────╮
│ Prefix : ${prefix}
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Type : Mickey       
╰────────────────╯

╭──[ 🕷 BUGS 🕷 ]────╮
│
│ ⇛ s-group < in group >
│ ⇛ s-kill 237xxxxx
│ ⇛ s-crash 237xxxxx
│ ⇛ s-delay 237xxxxx
│ ⇛ s-freeze 237xxxxx
│ ⇛ s-crashinvisi 237xxxxx
│ ⇛ s-crashios 237xxxxx        
╰────────────────╯       

> Powered By ${OWNER_NAME} Tech🥷🏾
`.trim();

        // -----------------------------------------------------------------
        // 3. Send the video + caption
        // -----------------------------------------------------------------
        await client.sendMessage(
            remoteJid,
            {
                video: { url: 'https://files.catbox.moe/8sawgv.mp4' },
                caption,
                // Optional: makes the message appear as sent by the bot itself
                // (helps when the bot is used in groups)
                // fromMe: true,
            },
            { quoted: message } // replies to the command message
        );

    } catch (error) {
        console.error('Error in bugMenu:', error);
        // Optional: notify the user that something went wrong
        const remoteJid = message?.key?.remoteJid;
        if (remoteJid && client) {
            await client.sendMessage(remoteJid, {
                text: '❌ An error occurred while sending the bug menu.'
            });
        }
    }
}

export default bugMenu;