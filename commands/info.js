import configManager from '../utils/manageConfigs.js'

import { BOT_NAME } from '../config.js'

import { OWNER_NAME } from '../config.js'

export async function info(message, client) {

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

╭──[ 💾 MEDIA 💾 ]─────╮
│
│ ⇛ vv 
│ ⇛ take  
│ ⇛ save 
│ ⇛ photo
│ ⇛ setpp
│ ⇛ getpp
│ ⇛ toaudio
│ ⇛ sticker
╰─────────────────╯


╭──[ 🔎 SEARCH 🔎 ]─────╮
│

│ ⇛ senku > question
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
        // Send the info text (quoted for context)
        await client.sendMessage(remoteJid, { text: t, quoted: message });

        // Define media URLs - replace with your real URLs or generate dynamically
        const audioUrl = 'https://file.catbox.moe/2th2bg.mp3'; // <-- change this
        const videoUrl = 'https://file.catbox.moe/vb0enr.mp4'; // <-- change this

        // Send audio by URL
        await client.sendMessage(remoteJid, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            ptt: false,
            quoted: message
        });

        // Send video by URL
        await client.sendMessage(remoteJid, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            quoted: message
        });

    } catch (err) {
        console.error('❌ Error sending info/media:', err);
        await client.sendMessage(remoteJid, { text: `❌ Failed to send info/media: ${err.message}`, quoted: message });
    }

}

export default info;
