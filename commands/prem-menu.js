import { BOT_NAME, OWNER_NAME } from '../config.js';
import configManager from '../utils/manageConfigs.js';

export async function prem(message, client) {
    const remoteJid = message.key.remoteJid;
    const today = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = daysOfWeek[today.getDay()];
    const currentDate = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const number = client.user.id.split(':')[0];
    const username = message.pushName || "Unknown";

    // Get prefix with fallback to default '.'
    const userPrefix = configManager.config.users?.[number]?.prefix || '.';
    
    const t = ` 
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Author : ${OWNER_NAME}
│ Type : THis commmand is for PREMIUM users only.        
╰─────────────────╯

╭─[ premium commands ]─╮
│      
│ ⬢ connect 237xxxxx
│ ⬢ disconnect 237xxxxx 
│ ⬢ reconnect       
╰─────────────────╯        

> Powered By ${OWNER_NAME} Tech 🥷🏾
    `;

    // Send image with caption text
    await client.sendMessage(remoteJid, {
        image: { url: "https://water-billimg.onrender.com/1761205727440.jpg" },
        caption: t,
        quoted: message
    });
}

export default prem;
