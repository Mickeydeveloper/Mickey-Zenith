import axios from "axios";
import { BOT_NAME, OWNER_NAME } from "../config.js";

export async function alive(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    try {
        // Thumbnail (high resolution)
        const thumbnailUrl = "https://files.catbox.moe/4zf57v.jpg";

        // System info
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(uptime % 60);
        const memUsage = process.memoryUsage();
        const ping = Date.now() - (message.messageTimestamp * 1000);

        const statusText = `⚡ *${BOT_NAME}* ⚡
━━━━━━━━━━━━━━━━━━━━
🟢 *STATUS:* ACTIVE
⏱️ *Uptime:* ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s
🔌 *Latency:* ${ping}ms
💾 *RAM:* ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
⚙️ *System:* ${process.platform}
🤖 *Node:* ${process.version}
━━━━━━━━━━━━━━━━━━━━
👤 *Owner:* ${OWNER_NAME}
🚀 *Version:* 5.2.0
_Powered by Mickey-Zenith_`;

        // Download thumbnail into buffer
        let thumbnailBuffer = null;
        try {
            const response = await axios.get(thumbnailUrl, {
                responseType: "arraybuffer",
                timeout: 10000
            });
            thumbnailBuffer = Buffer.from(response.data);
        } catch (err) {
            console.log("Thumbnail failed:", err);
            thumbnailBuffer = null;
        }

        // Meta-Ad style externalAdReply block
        const contextInfo = {
            externalAdReply: {
                title: `${BOT_NAME} System Status`,
                body: "Tap here for full dashboard",
                mediaType: 1,
                thumbnail: thumbnailBuffer,
                renderLargerThumbnail: true,
                showAdAttribution: true,        // Makes it look like Meta Ad
                sourceUrl: "https://github.com/Mickeydeveloper/Mickey-Zenith"
            }
        };

        await client.sendMessage(
            remoteJid,
            {
                text: statusText,
                contextInfo
            },
            { quoted: message }
        );

    } catch (error) {
        console.error("ALIVE ERROR:", error);
        await client.sendMessage(remoteJid, {
            text: "❌ *SYSTEM FAILURE* — Alive module crashed."
        });
    }
}

export default alive;
