import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

export async function info(message, client) {
    try {
        const remoteJid = message?.key?.remoteJid;
        if (!remoteJid) {
            console.error("Missing remoteJid. Cannot send message.");
            return;
        }

        const today = new Date();
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const number = client?.user?.id?.split(':')[0] || 'Unknown';
        const username = message?.pushName || "Unknown";
        const prefix = configManager?.config?.users?.[number]?.prefix || "!";

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
│ Prefix : ${prefix}
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

        // Send image with caption
        await client.sendMessage(remoteJid, {
            image: { url: "https://files.catbox.moe/8fqjpy.jpeg" },
            caption: infoText,
        });

        // Send audio
        await client.sendMessage(remoteJid, {
            audio: { url: "https://files.catbox.moe/2th2bg.mp3" },
            mimetype: 'audio/mp4',
        });

    } catch (error) {
        console.error("Error in info function:", error);
    }
}

export default info;
