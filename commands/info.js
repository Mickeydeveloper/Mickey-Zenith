import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';
import axios from 'axios';

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

    // Try to get a nice thumbnail for the menu
    const thumbnailUrl = 'https://water-billimg.onrender.com/1761205727440.jpg'; // Default menu image
    let thumbnailBuffer = null;
    
    try {
        const response = await axios.get(thumbnailUrl, { responseType: 'arraybuffer', timeout: 5000 });
        thumbnailBuffer = Buffer.from(response.data);
    } catch (err) {
        console.error('Failed to fetch thumbnail:', err);
    }

    const menuText = ` 
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 5.2.0
│ Author : ${OWNER_NAME}
│ Type : not for everyone, not yet released        
╰─────────────────╯

╭──[ ✨ MENUS ✨ ]─────╮
│
│ ⇛ menu
│ ⇛ prem-menu
│ ⇛ bug-menu
╰─────────────────╯

╭──[ 📃 STABLE 📃 ]──────╮
│ 
│ ⇛ ping
│ ⇛ getid
│ ⇛ alive
│ ⇛ sudo
│ ⇛ tourl
│ ⇛ owner    
│ ⇛ fancy   
│ ⇛ update
│ ⇛ device 
│ ⇛ delsudo
│ ⇛ getsudo
│ ⇛ love 
│ ⇛ order  
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
|
| ⇛ dlt
│ ⇛ bye
│ ⇛ kick
│ ⇛ add        
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
│ ⇛ Wiki-en > topic
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

    try {
        // Send message with image and caption
        await client.sendMessage(remoteJid, {
            image: { url: thumbnailUrl },
            caption: menuText,
            contextInfo: {
                externalAdReply: {
                    title: BOT_NAME,
                    body: OWNER_NAME,
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true,
                    showAdAttribution: false,
                    sourceUrl: "https://github.com/Mickeydeveloper/Mickey-Zenith"
                }
            },
            detectLinks: true
        }, { quoted: message });

    } catch (error) {
        console.error('Error in info command:', error);
        // Fallback to sending just text if there's an error
        await client.sendMessage(remoteJid, { text: menuText }, { quoted: message });
    }
}

export default info;
