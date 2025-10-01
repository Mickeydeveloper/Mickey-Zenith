
import configManager from '../utils/manageConfigs.js'

import { BOT_NAME } from '../config.js'

import { OWNER_NAME } from '../config.js'

export async function bugMenu(message, client) {

    const remoteJid = message.key.remoteJid;

    const today = new Date();

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const currentDay = daysOfWeek[today.getDay()];

    const currentDate = today.getDate();

    const currentMonth = today.getMonth() + 1; 

    const currentYear = today.getFullYear();

    const number = client.user.id.split(':')[0];

    const username = message.pushName || "Unknown";

    const t = ` 
╭────────────────╮
    ༒ ${BOT_NAME} ༒
╰────────────────╯
╭────────────────╮
│ Prefix : ${configManager.config.users[number].prefix}
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
`
;

    const r = await client.sendMessage(remoteJid, {

        video: { url: "https://files.catbox.moe/vljkk3.mp4" },

        caption: t,

    });

       await client.sendMessage(remoteJid, {

            audio: { url: "bug.mp3" }, 

            mimetype: 'audio/mp4',

            ptt: false,

            quoted: r
        });
}   

export default bugMenu;
