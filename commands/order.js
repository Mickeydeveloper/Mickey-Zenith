import axios from "axios";
import { BOT_NAME } from "../config.js";

// ===== CONFIGURATION =====
const ORDER_CONFIG = {
    baseRate: 1,
    bundles: [10, 20, 30, 40, 50],
    thumbnailUrl: "https://files.catbox.moe/v0bgg1.png",
    messageDelay: 3000, // 3 seconds for better UX
    paymentMethods: {
        tigo: "0711765335",
        halopesa: "0615944741",
        halotel: "0612130873",
        bank: "NMB — 24810015538"
    },
    githubUrl: "https://github.com/Mickeydeveloper"
};

// Tiered pricing helper: larger bundles get a small discount
function getPriceForBundle(gb) {
    const base = ORDER_CONFIG.baseRate;
    let discount = 0;
    if (gb >= 50) discount = 0.12;
    else if (gb >= 40) discount = 0.10;
    else if (gb >= 30) discount = 0.08;
    else if (gb >= 20) discount = 0.05;

    const raw = gb * base * (1 - discount);
    const price = Math.round(raw);
    const perGB = Math.round((price / gb) * 100) / 100; // two decimals
    return { price, perGB, discount };
}

// Format numbers as currency (TSHS)
function formatCurrency(n) {
    try {
        return n.toLocaleString('en-US');
    } catch (e) {
        return String(n);
    }
}

/**
 * Fetches and caches thumbnail for order messages
 * @returns {Promise<Buffer|null>} Thumbnail buffer or null if unavailable
 */
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

/**
 * Validates message and extracts user information
 * @param {Object} message - WhatsApp message object
 * @returns {Object|null} User info or null if invalid
 */
function validateAndExtractUser(message) {
    try {
        const remoteJid = message?.key?.remoteJid;
        const name = message?.pushName || "Customer";

        if (!remoteJid || typeof remoteJid !== "string") {
            console.error("❌ Invalid remoteJid:", remoteJid);
            return null;
        }

        return { remoteJid, name };
    } catch (error) {
        console.error("❌ Error validating message:", error);
        return null;
    }
}

/**
 * Formats bundle list with prices
 * @returns {string} Formatted bundle list
 */
function formatBundleList() {
    const { baseRate, bundles } = ORDER_CONFIG;
    // Build a nicely formatted list with per-GB price and savings
    return bundles
        .map(gb => {
            const { price, perGB, discount } = getPriceForBundle(gb);
            const fullPrice = gb * baseRate; // price without discount
            const savings = fullPrice - price;
            const discountText = discount > 0 ? ` • ${Math.round(discount * 100)}% off` : '';
            return `📦 *${gb}GB* — 💸 *${formatCurrency(price)} TSHS* (${perGB} TSH/GB)${discountText}${savings > 0 ? ` — Save ${formatCurrency(savings)} TSHS` : ''}`;
        })
        .join('\n');
}

/**
 * Creates the bundle announcement message
 * @param {string} name - Customer name
 * @returns {string} Formatted bundle message
 */

// Pretty variants (non-destructive): improved appearance for bundles and payments
function createBundleMessagePretty(name) {
    const { BOT_NAME_LOCAL: botName } = { BOT_NAME_LOCAL: BOT_NAME };
    const { baseRate } = ORDER_CONFIG;
    const bundleList = formatBundleList();

    return [
        `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮`,
        `┃ ✨ ${botName} — DATA BUNDLES ✨`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        `👋 Hello, *${name}*!`,
        ``,
        bundleList,
        ``,
        `💰 Rate: _1GB = ${baseRate} TSHS_`,
        ``,
        `🛒 How to order:`,
        `➡️  Type: *Order <size>GB*`,
        `   Example: *Order 10GB*`,
        ``,
        `⚡ Fast delivery | 💯 Trusted seller`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
    ].join('\n');
}

function createPaymentMessagePretty() {
    const { tigo, halopesa, halotel, bank } = ORDER_CONFIG.paymentMethods;

    return [
        `╭━━━━━━━━━━━━〔 💳 PAYMENT METHODS 〕━━━━━━━━━━━━╮`,
        `┃ Please choose one of the payment options below:`,
        `┃`,
        `┃ 🟣 Tigo Pesa: ${tigo}`,
        `┃ 🟢 Halopesa: ${halopesa}`,
        `┃ 🔵 Halotel / Others: ${halotel}`,
        `┃ 🏦 Bank: ${bank}`,
        `┃`,
        `┃ After payment, please send:`,
        `┃ • Your phone number`,
        `┃ • Bundle size (e.g., 20GB)`,
        `┃ • Delivery method (SMS / Auto)`,
        `┃`,
        `┃ ⏱️ Instant delivery after confirmation`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
    ].join('\n');
}

/**
 * Sends order message with thumbnail and disappearing timer
 * @param {Object} client - WhatsApp client
 * @param {string} remoteJid - Recipient JID
 * @param {string} message - Message text
 * @param {Buffer|null} thumbnail - Thumbnail buffer
 * @returns {Promise<Object>} Sent message object
 */
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

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Main order command handler
 * @param {Object} message - WhatsApp message object
 * @param {Object} client - WhatsApp client instance
 */
export async function order(message, client) {
    let userInfo = null;

    try {
        // Validate user and extract information
        userInfo = validateAndExtractUser(message);
        if (!userInfo) {
            console.error("❌ Invalid user information");
            return;
        }

        const { remoteJid, name } = userInfo;
        console.log(`📤 Processing order for: ${name} (${remoteJid})`);

        // Fetch thumbnail
        const thumbnail = await fetchThumbnail();

        // Create and send bundle message (pretty variant)
        const bundleMessage = createBundleMessagePretty(name);
        const sent = await sendOrderMessage(client, remoteJid, bundleMessage, thumbnail);

        if (!sent?.key?.id) {
            throw new Error("Failed to send initial message");
        }

        console.log(`✅ Bundle message sent (ID: ${sent.key.id})`);

        // Wait for smooth transition
        await sleep(ORDER_CONFIG.messageDelay);

        // Create and send payment message (pretty variant)
        const paymentMessage = createPaymentMessagePretty();
        await client.sendMessage(remoteJid, {
            text: paymentMessage,
            disappearingMessagesInChat: 30 // Messages disappear after 30 seconds
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
