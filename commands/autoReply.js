import { isJidGroup } from "@whiskeysockets/baileys";

const GREETINGS = ["hello", "hi", "hey", "good morning", "good evening", "good night"];
const AUTO_REPLY = "Hello! How can I assist you today?";

/**
 * Auto-reply command handler
 * @param {Object} message - WhatsApp message object
 * @param {Object} client - WhatsApp client instance
 */
export async function autoReply(message, client) {
    try {
        const remoteJid = message?.key?.remoteJid;
        if (!remoteJid || typeof remoteJid !== "string") {
            console.error("❌ Invalid remoteJid");
            return;
        }

        // Ignore group messages
        if (isJidGroup(remoteJid)) {
            return;
        }

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const lowerCaseBody = body.toLowerCase();

        // Check if the message contains a greeting
        if (GREETINGS.some((greeting) => lowerCaseBody.includes(greeting))) {
            await client.sendMessage(remoteJid, {
                text: AUTO_REPLY,
                quoted: message
            });
            console.log(`✅ Auto-reply sent to ${remoteJid}`);
        }
    } catch (error) {
        console.error("❌ Error in autoReply command:", error.message);
    }
}

export default autoReply;