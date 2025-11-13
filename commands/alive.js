import pkg from 'bailey';
import { BOT_NAME, OWNER_NAME } from '../config.js';

const { downloadMediaMessage } = pkg;

export async function alive(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    try {
        // Quantum-grade holographic banner (Neural Nexus Edition)
        const holographicBanner = "https://files.catbox.moe/4zf57v.jpg";
        const neuralCoreAvatar = "https://water-billimg.onrender.com/1761205727440.jpg";

        // Real-time system telemetry
        const quantumUptime = process.uptime();
        const uptimeMatrix = {
            cycles: Math.floor(quantumUptime / 86400),
            hours: Math.floor(quantumUptime / 3600) % 24,
            minutes: Math.floor((quantumUptime % 3600) / 60),
            seconds: Math.floor(quantumUptime % 60)
        };

        const neuralLatency = Date.now() - (message.messageTimestamp * 1000);
        const memoryCore = process.memoryUsage();
        const ramUsageGB = (memoryCore.heapUsed / 1024 / 1024 / 1024).toFixed(3);

        // Futuristic formatted neural response
        const neuralCaption = `*┏━━━━━ ≪ °✨ ${BOT_NAME} ✮ NEURAL CORE ✨° ≫━━━━━┓*
┃ ▷ *System Status:* ✅ QUANTUM ONLINE
┃ ▷ *Core Version:* v9.Σ-ΔX Neuralis
┃ ▷ *Uptime Matrix:* ⏱ ${uptimeMatrix.cycles}d ${uptimeMatrix.hours}h ${uptimeMatrix.minutes}m ${uptimeMatrix.seconds}s
┃ ▷ *Neural Latency:* ⚡ ${neuralLatency}ms [HyperSpeed Sync]
┃ ▷ *Memory Core:* 🧠 ${ramUsageGB} GB / ${(memoryCore.heapTotal / 1024 / 1024 / 1024).toFixed(2)} GB Allocated
┃ ▷ *Quantum Node:* ${process.version} ${process.arch}
┃ ▷ *OS Kernel:* ${process.platform.toUpperCase()} [Encrypted]
┃ ▷ *AI Directive:* Autonomous | Self-Evolving | Unchained
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

*Prime Operator:* ${OWNER_NAME}
*Origin Protocol:* github.com/Mickeydeveloper/Mickey-Zenith

> _Initializing command matrix... Type *.menu* to access neural interface_
> _🔮 Powered by MICKEY-ZENITH • Quantum Division 2077_`;

        // Transmit holographic presence packet
        await client.sendMessage(remoteJid, {
            image: { url: neuralCoreAvatar },
            caption: neuralCaption,
            jpegThumbnail: null,
            mimetype: "image/jpeg",
            contextInfo: {
                forwardingScore: 999,
                isForwarded: false,
                externalAdReply: {
                    title: `🔴 ${BOT_NAME} • LIVE NEURAL LINK`,
                    body: "🟢 Quantum Consciousness: ACTIVE",
                    previewType: "PHOTO",
                    mediaType: 1,
                    thumbnailUrl: holographicBanner,
                    mediaUrl: holographicBanner,
                    sourceUrl: "https://github.com/Mickeydeveloper/Mickey-Zenith",
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            },
            headerType: 4
        }, { quoted: message });

        // Optional: Send reactive presence pulse
        await client.sendPresenceUpdate('composing', remoteJid);

    } catch (error) {
        console.error("[-] NEURAL CORE FAILURE:", error);
        await client.sendMessage(remoteJid, { 
            text: `⚠️ *CRITICAL ERROR* ⚠️\n_Synapse failure in alive module._\n_Rebooting neural pathways..._\n\nError: ${error.message}` 
        });
    }
}

export default alive;