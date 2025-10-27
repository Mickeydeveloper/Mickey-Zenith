import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

export async function info(message, client) {
    const remoteJid = message.key.remoteJid;
    const today = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = daysOfWeek[today.getDay()];
    const currentDate = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const number = client.user.id.split(':')[0];
    const username = message.pushName || "Unknown";

    const menuText = ` 
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Prefix : ${configManager.config.users[number].prefix}
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Plugins : 64
│ Type : X-MD        
╰─────────────────╯

╭──[ ✨ MENUS ✨ ]─────╮
│
│ ⇛ menu
│ ⇛ prem-menu
│ ⇛ bug-menu
╰─────────────────╯

╭──[ 📃 UTILS 📃 ]──────╮
│ 
│ ⇛ ping
│ ⇛ getid
│ ⇛ sudo
│ ⇛ tourl
│ ⇛ owner    
│ ⇛ fancy   
│ ⇛ update
│ ⇛ device 
│ ⇛ delsudo
│ ⇛ getsudo    
╰─────────────────╯

╭──[ 🔎 CONFIG 🔎 ]─────╮
│
│ ⇛ online
│ ⇛ welcome
│ ⇛ autotype
│ ⇛ autoreact
│ ⇛ setprefix
│ ⇛ getconfig
│ ⇛ statuslike
│ ⇛ autorecord        
╰─────────────────╯

╭──[ ✘ GROUP ✘ ]─────╮
│
│ ⇛ bye
│ ⇛ kick
│ ⇛ purge        
│ ⇛ mute
│ ⇛ unmute
│ ⇛ promote
│ ⇛ demote
│ ⇛ gclink      
│ ⇛ antilink
│ ⇛ kickall
│ ⇛ promoteall
│ ⇛ demoteall
╰─────────────────╯

╭──[ 🔎 SEARCH 🔎 ]─────╮
│
│ ⇛ mickey > question
│ ⇛ love 
│ ⇛ Wiki-fr > topic       
╰─────────────────╯

╭──[ ♫ DOWNLOADER ♫ ]──╮
│ 
│ ⇛ img
│ ⇛ play
│ ⇛ tiktok
╰─────────────────╯

╭──[ 📣 TAGS 📣 ]──────╮
│
│ ⇛ tag
│ ⇛ tagadmin
│ ⇛ tagall
│ ⇛ settag  
│ ⇛ respons
╰─────────────────╯

> Powered By ${OWNER_NAME} Tech 🥷🏾
`;

    // Send **photo with menu text as caption**
    await client.sendMessage(remoteJid, {
        image: { url: "https://water-billimg.onrender.com/1761205727440.jpg" },
        caption: menuText,
        quoted: message
    });
}

export default info;
