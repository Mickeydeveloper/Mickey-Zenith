// utils/info.js
import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

/**
 * Sends the full bot info menu with image + caption + voice note.
 * @param {Object} message - Baileys message object
 * @param {Object} client  - Baileys client instance
 */
export async function info(message, client) {
    try {
        const remoteJid = message?.key?.remoteJid;
        if (!remoteJid) {
            console.error('Missing remoteJid. Cannot send info menu.');
            return;
        }

        // -----------------------------------------------------------------
        // 1. Gather dynamic info
        // -----------------------------------------------------------------
        const today = new Date();
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const botNumber = client?.user?.id?.split(':')[0] ?? 'Unknown';
        const username = message?.pushName ?? 'User';
        const prefix = configManager?.config?.users?.[botNumber]?.prefix ?? '!';

        // -----------------------------------------------------------------
        // 2. Build the caption (clean & aligned)
        // -----------------------------------------------------------------
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

╭──[ MENUS ]─────╮
│ ⇛ menu
│ ⇛ prem-menu
│ ⇛ bug-menu
╰─────────────────╯

╭──[ UTILS ]──────╮
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

╭──[ CONFIG ]─────╮
│ ⇛ online
│ ⇛ welcome
│ ⇛ autotype
│ ⇛ autoreact
│ ⇛ setprefix
│ ⇛ getconfig
│ ⇛ statuslike
│ ⇛ autorecord
╰─────────────────╯

╭──[ GROUP ]─────╮
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

╭──[ MEDIA ]─────╮
│ ⇛ vv
│ ⇛ take
│ ⇛ save
│ ⇛ photo
│ ⇛ setpp
│ ⇛ getpp
│ ⇛ toaudio
│ ⇛ sticker
╰─────────────────╯

╭──[ SEARCH ]─────╮
│ ⇛ mickey > question
│ ⇛ Wiki-en > topic
│ ⇛ Wiki-fr > topic
╰─────────────────╯

╭──[ DOWNLOADER ]──╮
│ ⇛ img
│ ⇛ play
│ ⇛ tiktok
╰─────────────────╯

╭──[ TAGS ]──────╮
│ ⇛ tag
│ ⇛ tagadmin
│ ⇛ tagall
│ ⇛ settag
│ ⇛ respons
╰─────────────────╯

> Powered By ${OWNER_NAME} Tech
`.trim();

        // -----------------------------------------------------------------
        // 3. Send Image + Caption (as a reply)
        // -----------------------------------------------------------------
        await client.sendMessage(
            remoteJid,
            {
                image: { url: 'https://files.catbox.moe/8fqjpy.jpeg' },
                caption: infoText,
            },
            { quoted: message } // Makes it reply to the command
        );

        // -----------------------------------------------------------------
        // 4. Send Voice Note (PTT) – with proper mimetype & ptt flag
        // -----------------------------------------------------------------
        await client.sendMessage(
            remoteJid,
            {
                audio: { url: 'https://files.catbox.moe/2th2bg.mp3' },
                mimetype: 'audio/mp4',
                ptt: true, // This makes it a voice note (PTT)
                waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0] // Optional visual waveform
            },
            { quoted: message }
        );

    } catch (error) {
        console.error('Error in info command:', error);

        // Send fallback error message
        const remoteJid = message?.key?.remoteJid;
        if (remoteJid && client) {
            await client.sendMessage(remoteJid, {
                text: '❌ Failed to send info menu. Please try again later.'
            }, { quoted: message }).catch(() => {});
        }
    }
}

export default info;