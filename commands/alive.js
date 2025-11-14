import { downloadMediaMessage } from 'baileys';
import { BOT_NAME, OWNER_NAME } from '../config.js';

export async function alive(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    try {
        // Bot thumbnail image - High quality
        const thumbnailUrl = "https://files.catbox.moe/4zf57v.jpg";
        
        // Get system stats
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(uptime % 60);
        const memUsage = process.memoryUsage();
        const ping = Date.now() - message.messageTimestamp * 1000;
        
        // Futuristic formatted text with system info
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

        // Download and buffer the thumbnail like play.js
        let thumbnailBuffer = null;
        try {
            const thumbResponse = await axios.get(thumbnailUrl, { 
                responseType: 'arraybuffer', 
                timeout: 10000 
            });
            thumbnailBuffer = Buffer.from(thumbResponse.data);
        } catch (e) {
            console.error("Failed to download thumbnail:", e);
            thumbnailBuffer = null;
        }

        // Send with context info like play.js formula
        const contextInfo = thumbnailBuffer ? { 
            contextInfo: { 
                externalAdReply: { 
                    title: BOT_NAME, 
                    body: statusText, 
                    mediaType: 1, 
                    previewType: 0, 
                    thumbnail: thumbnailBuffer, 
                    renderLargerThumbnail: true,
                    sourceUrl: "https://github.com/Mickeydeveloper/Mickey-Zenith"
                } 
            } 
        } : {};

        // Send ONLY thumbnail without image URL
        await client.sendMessage(remoteJid, { 
            text: statusText,
            ...contextInfo
        }, { quoted: message });

    } catch (error) {
        console.error("Error in alive command:", error);
        await client.sendMessage(remoteJid, { 
            text: "❌ *SYSTEM ERROR* ❌\n\n_Neural protocols interrupted. Please retry initialization._" 
        });
    }
}


export default alive;
