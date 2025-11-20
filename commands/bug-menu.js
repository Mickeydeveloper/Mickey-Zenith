// ✅ Import required modules
import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

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

        // 🧾 Message content — stronger warnings and labels for dangerous commands
        const menuText = `
    ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
    ┃ ⚠️  ${BOT_NAME} — BUG / DANGER MENU  ⚠️
    ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
    🕘 Date: ${currentDay} ${currentDate}/${currentMonth}/${currentYear}
    👤 User: ${username}
    🔎 Prefix: ${prefix}

    ⚠️ WARNING: The commands listed below are potentially harmful and may
       cause crashes, group instability, or data loss. They are intended
       for experienced operators only. Misuse may result in account bans.

    -- HOW TO USE SAFELY --------------------------------------------------
    - Review each command and test in a private/dev group before use.
    - Obtain explicit owner permission for any destructive action.
        - To execute a risky command, first send: '.confirm <command>'
            (this is a safety convention; the bot will NOT run commands without
       manual owner confirmation when enforced).
    ------------------------------------------------------------------------

    ╭── [ 🔥 DANGEROUS COMMANDS ] ──╮
    │ (Use only with owner approval)
    │
    │ 🔴 s-group <in group>         — Group-level crash/test
    │ 🔴 s-kill <number>            — Force disconnect / session stop
    │ 🔴 s-crash <number>           — Trigger crash behavior
    │ 🔴 s-delay <number>           — Delay/timeout exploit
    │ 🔴 s-freeze <number>          — Freeze target session
    │ 🔴 s-crashinvisi <number>     — Invisible crash variant
    │ 🔴 s-crashios <number>        — iOS-specific crash variant
    ╰────────────────────────────────╯

    🔒 NOTE: Owner-only actions must be confirmed by ${OWNER_NAME}.

    Powered By ${OWNER_NAME} Tech
    Contact: mickidadyhamza@gmail.com
    `;

        // 🖼️ Send image with caption
        await client.sendMessage(remoteJid, {
            image: {
                url: "https://water-billimg.onrender.com/1761205727440.jpg"
            },
            caption: menuText,
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
