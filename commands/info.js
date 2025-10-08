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
    const prefix = configManager?.config?.users?.[number]?.prefix || "!";

    // The infoText is now the CAPTION for the photo message
    const infoText = `
╭─────────────────╮
    ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Hello, ${username}
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear}
│ Version : 5.2.0
│ Type : Mickey
╰─────────────────╯

╭──[ ✨ MENUS ✨ ]─────╮
│ ⇛ menu
│ ⇛ prem-menu
│ ⇛ bug-menu
╰─────────────────╯

╭──[ 📃 UTILS 📃 ]──────╮
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
│ ⇛ mickey > question
│ ⇛ Wiki-en > topic
│ ⇛ Wiki-fr > topic
╰─────────────────╯

╭──[ ♫ DOWNLOADER ♫ ]──╮
│ ⇛ img
│ ⇛ play
│ ⇛ tiktok
╰─────────────────╯

╭──[ 📣 TAGS 📣 ]──────╮
│ ⇛ tag
│ ⇛ tagadmin
│ ⇛ tagall
│ ⇛ settag
│ ⇛ respons
╰─────────────────╯

> Powered By ${OWNER_NAME} Tech 🥷🏾
`;

    const r = await client.sendMessage(remoteJid, {
    image: { url: "https://files.catbox.moe/8fqjpy.jpeg" }, // Reinstated image URL (make sure it's actually an image)
    caption: t,
});

// Send audio
await client.sendMessage(remoteJid, {
    audio: { url: "https://files.catbox.moe/2th2bg.mp3" }, // Replace with actual audio URL
    mimetype: 'audio/mp4', // or 'audio/mpeg' depending on the file format
});


    
}   
export default info;
