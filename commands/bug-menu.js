// ✅ Import required modules
import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';
import axios from 'axios';

// ✅ Define the bugMenu function
export async function bugMenu(message, client) {
    try {
        const remoteJid = message.key.remoteJid;
        const today = new Date();

        // 📅 Date and time details
        const daysOfWeek = [
            "Sunday", "Monday", "Tuesday", "Wednesday",
            "Thursday", "Friday", "Saturday"
        ];

        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 👤 User and client info
        const number = client.user.id.split(':')[0];
        const username = message.pushName || "Unknown User";
        const prefix = configManager?.config?.users?.[number]?.prefix || ".";

        // 🧾 Message content
        const menuText = `
╔════════════════════════════════╗
║     🔥  D A N G E R  C O M M A N D 🔥     ║
╚════════════════════════════════╝

⚠️  WARNING: These commands are powerful and may disrupt devices or groups.
    Use only if you understand the consequences. Misuse can cause permanent
    issues and may be against terms of service.

Bot : ${BOT_NAME}
User: ${username}
Prefix: ${prefix}
When: ${currentDay} ${currentDate}/${currentMonth}/${currentYear}

--- AVAILABLE DANGEROUS COMMANDS ---
• s-group <in group>        - perform group-level stress
• s-kill <number>          - targeted crash attempt
• s-crash <number>         - crash routine
• s-delay <number>         - inject delay
• s-freeze <number>        - attempt to freeze session
• s-crashinvisi <number>   - stealth crash
• s-crashios <number>      - iOS-specific crash routine

--- BEFORE YOU PROCEED ---
1) Confirm you have permission to run these commands.
2) To execute, type: ${prefix}danger confirm  (this shows an extra confirmation).
3) To cancel, type: ${prefix}danger cancel  or ignore this message.

Powered By ${OWNER_NAME} Tech

`;

        // 🖼️ Try to fetch thumbnail buffer like `play.js` to render a rich preview
        const imageUrl = "https://water-billimg.onrender.com/1761205727440.jpg";
        let thumbBuffer = null;
        try {
            const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            thumbBuffer = Buffer.from(res.data);
        } catch (e) {
            thumbBuffer = null;
        }

        const contextInfo = thumbBuffer ? { contextInfo: { externalAdReply: { title: BOT_NAME, body: OWNER_NAME, mediaType: 1, previewType: 0, thumbnail: thumbBuffer, renderLargerThumbnail: true } } } : {};

        // Send the menu as an image with the rich preview when possible
        await client.sendMessage(remoteJid, {
            image: { url: imageUrl },
            caption: menuText,
            ...contextInfo
        });

    } catch (error) {
        console.error("❌ Error in bugMenu:", error);
        if (message?.key?.remoteJid && client) {
            await client.sendMessage(message.key.remoteJid, {
                text: "❌ An error occurred while sending the bug menu."
            });
        }
    }
}

// ✅ Export as default
export default bugMenu;
