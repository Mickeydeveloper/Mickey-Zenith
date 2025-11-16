import axios from "axios";
import { BOT_NAME } from "../config.js";

export async function order(message, client) {
    try {
        const remoteJid = message?.key?.remoteJid;
        const name = message?.pushName || "Customer";
        if (!remoteJid) return;

        // ===== FUTURE-READY PRICES =====
        const baseRate = 1; // 1GB = 1 TSHS
        const bundles = [10, 20, 30, 40, 50]; // easily expandable later

        const bundleList = bundles
            .map(gb => `📦 *${gb}GB* — *${gb * baseRate} TSHS*`)
            .join("\n");

        // Thumbnail (for future branding)
        const thumbnailUrl = "https://files.catbox.moe/v0bgg1.png";
        let thumbnailBuffer = null;

        try {
            const res = await axios.get(thumbnailUrl, { responseType: "arraybuffer" });
            thumbnailBuffer = Buffer.from(res.data);
        } catch {
            thumbnailBuffer = null;
        }

        // ===== First Message (Bundles) =====
        const bundleMessage =
`╭━━━〔 *${BOT_NAME} — DATA BUNDLES* 〕━━━╮
👋 Hello *${name}*, below are our official bundle prices:

${bundleList}

💰 *Rate:* _1GB = ${baseRate} TSHS_

🛒 To order, send:
➡️  *Order <size>GB*
Example:  *Order 10GB*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        const sent = await client.sendMessage(
            remoteJid,
            {
                text: bundleMessage,
                contextInfo: {
                    externalAdReply: {
                        title: `${BOT_NAME} Bundles`,
                        body: "Affordable data packages",
                        mediaType: 1,
                        thumbnail: thumbnailBuffer,
                        renderLargerThumbnail: true,
                        sourceUrl: "https://github.com/Mickeydeveloper"
                    }
                }
            }
        );

        // ===== Wait then EDIT message =====
        const msgId = sent.key.id;

        await sleep(5000); // smooth transition

        const paymentMessage =
`╭━━━〔 *PAYMENT METHODS* 〕━━━╮
💳 Choose any method below:

• 🟣 *Tigo Pesa:* 071176535
• 🟢 *Halopesa 1:* 0615944741
• 🔵 *Halotel / Others:* 0612130873
• 🏦 *Bank:* NMB — 24810015538

📤 After payment send:
• Phone number
• Bundle size (e.g., *20GB*)
• Delivery method (SMS / Auto)

⏱️ Delivery is instant after confirmation.
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await client.sendMessage(remoteJid, {
            text: paymentMessage,
            edit: {
                remoteJid,
                id: msgId,
                fromMe: true
            }
        });

    } catch (error) {
        console.error("ORDER CMD ERROR:", error);
        await client.sendMessage(message.key.remoteJid, {
            text: "❌ Something went wrong processing your order."
        });
    }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export default order;
