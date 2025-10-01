import { BOT_NAME } from '../config.js'

import { OWNER_NAME } from '../config.js'

import configManager from '../utils/manageConfigs.js'

export async function prem(message, client) {

    const remoteJid = message.key.remoteJid;

    const today = new Date();

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const currentDay = daysOfWeek[today.getDay()];

    const currentDate = today.getDate();

    const currentMonth = today.getMonth() + 1; 

    const currentYear = today.getFullYear();

    const owner = "𓂀 𝕊𝕖𝕟𝕜𝕦𓂀";

    const number = client.user.id.split(':')[0];

    const username = message.pushName || "Unknown";

    const t = ` 
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Prefix : ${configManager.config.users[number].prefix}
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Base :Mickey        
╰─────────────────╯

╭─[ ✧ PREMIUM CMD ✧ ]──╮
│      
│ ⬢ connect 237xxxxx
│ ⬢ disconnect 237xxxxx 
│ ⬢ reconnect       
╰─────────────────╯        

> Powered By ${OWNER_NAME} Tech 🥷🏾
    `
;

    await client.sendMessage(remoteJid, {

        image: { url: "menu.jpg" },

        caption: t,

        quoted: message 


    });
}   

export default prem;
