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
        // Send the info text
        await client.sendMessage(remoteJid, { text: infoText, quoted: message });

        // URLs for audio and photo
        const audioUrl = 'https://files.catbox.moe/2th2bg.mp3';
        const photoUrl = 'https://ibb.co/Ndg8NMQH'; // Replace with your photo URL

        // Send audio
        if (audioUrl) {
            await client.sendMessage(remoteJid, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                quoted: message
            });
        }

        // Send photo
        if (photoUrl) {
            await client.sendMessage(remoteJid, {
                image: { url: photoUrl },
                mimetype: 'image/jpeg',
                caption: 'Here is the photo',
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
