import { BOT_NAME, OWNER_NAME } from '../config.js';
import configManager from '../utils/manageConfigs.js';

export async function prem(message, client) {
    const remoteJid = message.key.remoteJid;
    const today = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = daysOfWeek[today.getDay()];
    const currentDate = today.getDate().toString().padStart(2, '0');
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = today.getFullYear();
    const number = client.user.id.split(':')[0];
    const username = message.pushName || "Unknown";

    // Get prefix with fallback to default '.'
    const userPrefix = configManager.config.users?.[number]?.prefix || '.';
    
    const t = `
╭━━━『 ${BOT_NAME} Premium Menu 』━━━╮
┃ 👋 Hello, ${username}
┃ 📅 Day: ${currentDay}
┃ 🗓️ Date: ${currentDate}/${currentMonth}/${currentYear}
┃ 🛠️ Version: 5.2.0
┃ 👑 Author: ${OWNER_NAME}
┃ 🔒 Type: This command is for PREMIUM users only.
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭───『 ✨ PREMIUM COMMANDS ✨ 』───╮
┃ ${userPrefix}connect <number>   🔗
┃ ${userPrefix}disconnect <number> ❌
┃ ${userPrefix}reconnect          ♻️
┃ ${userPrefix}order-admin        🛒
┃ ${userPrefix}premiums           💎
┃ ${userPrefix}prem-menu          📜
┃ ${userPrefix}autoReply          🤖
┃ ${userPrefix}channelSender      📡
┃ ...and more!
╰───────────────────────────────╯

🔋 Powered By ${OWNER_NAME} Tech 🥷🏾
    `;

    // Send image with caption text
    await client.sendMessage(remoteJid, {
        image: { url: "https://water-billimg.onrender.com/1761205727440.jpg" },
        caption: t,
        quoted: message
    });
}

export default prem;
