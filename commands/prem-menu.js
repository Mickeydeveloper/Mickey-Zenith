import { BOT_NAME, OWNER_NAME } from '../config.js';
import configManager from '../utils/manageConfigs.js';

export async function prem(message, client) {
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
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Prefix : ${prefix}
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Base : Mickey        
╰─────────────────╯

╭─[ ✧ PREMIUM CMD ✧ ]──╮
│      
│ ⬢ connect 237xxxxx
│ ⬢ disconnect 237xxxxx 
│ ⬢ reconnect       
╰─────────────────╯        

> Powered By ${OWNER_NAME} Tech 🥷🏾
`;

        // Send image with caption
        await client.sendMessage(remoteJid, {
            image: { url: "https://files.catbox.moe/8fqjpy.jpeg" },
            caption: caption,
        });

        // Send audio
        await client.sendMessage(remoteJid, {
            audio: { url: "https://files.catbox.moe/2th2bg.mp3" },
            mimetype: 'audio/mp4',
        });

    } catch (error) {
        console.error("Error in prem function:", error);
    }
}

export default prem;
