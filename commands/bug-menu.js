import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

export async function bugMenu(message, client) {
    try {
        const remoteJid = message?.key?.remoteJid;
        const today = new Date();
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const number = client?.user?.id?.split(':')[0] || 'Unknown';
        const username = message?.pushName || "Unknown";
        const prefix = configManager?.config?.users?.[number]?.prefix || '!';

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
`;

        await client.sendMessage(remoteJid, {
            video: { url: "https://files.catbox.moe/8sawgv.mp4" },
            caption: caption,
        });
    } catch (error) {
        console.error("Error in bugMenu:", error);
    }
}

export default bugMenu;
