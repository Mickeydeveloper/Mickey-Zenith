import axios from "axios";
import { BOT_NAME } from "../config.js";

// ===== ORDER CONFIGURATION =====
const ORDER_CONFIG = {
    baseRate: 1,
    bundles: [10, 20, 30, 40, 50],
    thumbnailUrl: "https://files.catbox.moe/v0bgg1.png",
    messageDelay: 2500, // 2.5 seconds for better UX
    paymentMethods: {
        tigo: "0711765335",
        halopesa: "0615944741",
        halotel: "0612130873",
        bank: "NMB — 24810015538"
    },
    githubUrl: "https://github.com/Mickeydeveloper"
};

// Fetches thumbnail for order messages
async function fetchThumbnail() {
    try {
        const res = await axios.get(ORDER_CONFIG.thumbnailUrl, {
            responseType: "arraybuffer",
            timeout: 5000
        });
        return Buffer.from(res.data);
    } catch (error) {
        console.warn("⚠️ Failed to fetch thumbnail:", error.message);
        return null;
    }
}

// Extracts user info from message
function extractUserInfo(message) {
    const remoteJid = message?.key?.remoteJid;
    const name = message?.pushName || "Customer";
    if (!remoteJid || typeof remoteJid !== "string") {
        console.error("❌ Invalid remoteJid:", remoteJid);
        return null;
    }
    return { remoteJid, name };
}

// Formats bundle list with prices
function formatBundleList() {
    const { baseRate, bundles } = ORDER_CONFIG;
    return bundles.map(gb => `📦 *${gb}GB* — *${gb * baseRate} TSHS*`).join("\n");
}

// Creates the bundle announcement message
function createBundleMessage(name) {
    const botName = BOT_NAME;
    const { baseRate } = ORDER_CONFIG;
    const bundleList = formatBundleList();
    return (
        `╭━━━〔 *${botName} — DATA BUNDLES* 〕━━━╮\n` +
        `👋 Hello *${name}*, below are our official bundle prices:\n\n` +
        `${bundleList}\n\n` +
        `💰 *Rate:* _1GB = ${baseRate} TSHS_\n\n` +
        `🛒 To order, send:\n` +
        `➡️  *Order <size>GB*\n` +
        `Example:  *Order 10GB*\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
    );
}

// Creates the payment methods message
function createPaymentMessage() {
    const { tigo, halopesa, halotel, bank } = ORDER_CONFIG.paymentMethods;
    return (
        `╭━━━〔 *PAYMENT METHODS* 〕━━━╮\n` +
        `💳 Choose any method below:\n\n` +
        `• 🟣 *Tigo Pesa:* ${tigo}\n` +
        `• 🟢 *Halopesa 1:* ${halopesa}\n` +
        `• 🔵 *Halotel / Others:* ${halotel}\n` +
        `• 🏦 *Bank:* ${bank}\n\n` +
        `📤 After payment send:\n` +
        `• Phone number\n` +
        `• Bundle size (e.g., *20GB*)\n` +
        `• Delivery method (SMS / Auto)\n\n` +
        `⏱️ Delivery is instant after confirmation.\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━╯`
    );
}

// Sends order message with thumbnail and disappearing timer
async function sendOrderMessage(client, remoteJid, message, thumbnail) {
    return client.sendMessage(remoteJid, {
        text: message,
        disappearingMessagesInChat: 30, // Messages disappear after 30 seconds
        contextInfo: {
            externalAdReply: {
                title: `${BOT_NAME} Bundles`,
                body: "Affordable data packages",
                mediaType: 1,
                thumbnail: thumbnail,
                renderLargerThumbnail: true,
                sourceUrl: ORDER_CONFIG.githubUrl
            }
        }
    });
}

// Sleep utility
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// Main order command handler
export async function order(message, client) {
    let userInfo = null;
    try {
        userInfo = extractUserInfo(message);
        if (!userInfo) {
            console.error("❌ Invalid user information");
            return;
        }
        const { remoteJid, name } = userInfo;
        console.log(`📤 Processing order for: ${name} (${remoteJid})`);

        // Fetch thumbnail and send bundle message
        const thumbnail = await fetchThumbnail();
        const bundleMessage = createBundleMessage(name);
        const sent = await sendOrderMessage(client, remoteJid, bundleMessage, thumbnail);
        if (!sent?.key?.id) throw new Error("Failed to send initial message");
        console.log(`✅ Bundle message sent (ID: ${sent.key.id})`);

        // Wait for smooth transition
        await sleep(ORDER_CONFIG.messageDelay);

        // Send payment message
        const paymentMessage = createPaymentMessage();
        await client.sendMessage(remoteJid, {
            text: paymentMessage,
            disappearingMessagesInChat: 30
        });
        console.log(`✅ Payment message sent successfully`);
    } catch (error) {
        console.error("❌ ORDER CMD ERROR:", error.message);
        if (userInfo?.remoteJid) {
            try {
                await client.sendMessage(userInfo.remoteJid, {
                    text: "❌ An error occurred while processing your order. Please try again later or contact support."
                });
            } catch (sendError) {
                console.error("❌ Failed to send error message:", sendError.message);
            }
        }
    }
}

export default order;
