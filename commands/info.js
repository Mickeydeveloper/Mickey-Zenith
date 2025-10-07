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
    const photoUrl = 'https://files.catbox.moe/8fqjpy.jpeg'; // Your photo URL


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
│ ⇛ senku > question
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

    try {
        // URLs for audio
        const audioUrl = 'https://files.catbox.moe/2th2bg.mp3';

        // 1. Send the PHOTO first with the infoText as the caption
        if (photoUrl) {
            await client.sendMessage(remoteJid, {
                // Assuming your WhatsApp client library uses the 'image' or 'document'
                // key for media from a URL, and 'caption' for the text.
                image: { url: photoUrl }, 
                caption: infoText, 
                quoted: message
            });
        }
        
        // 2. Send the AUDIO message after
        if (audioUrl) {
            await client.sendMessage(remoteJid, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                quoted: message
            });
        }

    } catch (err) {
        console.error('❌ Error sending info/media:', err);
        await client.sendMessage(remoteJid, {
            text: `❌ Failed to send info/media: ${err.message}`,
            quoted: message
        });
    }
}

export default info;
