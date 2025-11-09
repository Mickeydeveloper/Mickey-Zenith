import pkg from 'bailey';
import { BOT_NAME, OWNER_NAME } from '../config.js';

const { downloadMediaMessage } = pkg;

export async function alive(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    try {
        // High quality bot logo/banner image
        const imageUrl = "https://files.catbox.moe/4zf57v.jpg"; // Your bot's image
        
        // Get system stats
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(uptime % 60);
        const memUsage = process.memoryUsage();
        const ping = Date.now() - message.messageTimestamp * 1000;
        
        // Rich formatted caption with stats and styling
        const caption = `*╭────『 ${BOT_NAME} 』────╮*
├ *Status:* ⚡ Active
├ *Version:* 🤖 5.2.0
├ *Uptime:* ⏰ ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s
├ *Latency:* 🚀 ${ping}ms
├ *Memory:* 💾 ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
├ *Platform:* ${process.platform} ${process.arch}
├ *Node:* ${process.version}
╰────────────────╯

*Owner:* ${OWNER_NAME}
*GitHub:* https://github.com/Mickeydeveloper/Mickey-Zenith

_Type .menu to see available commands_
_✨ Powered by Mickey-Zenith_`;

        // Send image with rich caption and specific configuration
        await client.sendMessage(remoteJid, {
            image: { url: "https://water-billimg.onrender.com/1761205727440.jpg" },
            caption: caption,
            jpegThumbnail: null, // Let WhatsApp generate thumbnail
            contextInfo: {
                externalAdReply: {
                    title: BOT_NAME,
                    body: "Bot Status: Online ✅",
                    mediaType: 1,
                    thumbnailUrl: imageUrl,
                    sourceUrl: "https://github.com/Mickeydeveloper/Mickey-Zenith",
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error("Error in alive command:", error);
        await client.sendMessage(remoteJid, { 
            text: "❌ Error executing alive command. Please try again later." 
        });
    }
}

export default alive;