import { isJidGroup } from "@whiskeysockets/baileys";
import { fetchAIAnswer } from './mickey.js';

// Cooldown per sender to avoid spamming replies (milliseconds)
const REPLY_COOLDOWN_MS = 60 * 1000; // 60 seconds
const lastReplyMap = new Map();

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
        if (isJidGroup(remoteJid)) return;

        // Ignore messages sent by this bot (avoid loops)
        if (message?.key?.fromMe) return;

        // Prevent replying too frequently to the same user
        const now = Date.now();
        const last = lastReplyMap.get(remoteJid) || 0;
        if (now - last < REPLY_COOLDOWN_MS) {
            console.log(`Skipping auto-reply to ${remoteJid} (cooldown)`);
            return;
        }

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const lowerCaseBody = body.toLowerCase();
        // Only handle text messages with some content
        if (!body || typeof body !== 'string' || body.trim().length === 0) return;

        // Build a query prompt to extract name, phone number and basic info
        const aiPrompt = `Extract the person's name, phone number, and basic information from the following text. Reply in plain text with each field on its own line as "Name: ...\nPhone: ...\nInfo: ...". If none found, reply "No personal info found".\n\nText: "${body.replace(/"/g, '\\"')}"`;

        try {
            // Send a short thinking indicator (optional)
            await client.sendMessage(remoteJid, { text: '⏳ Processing your message…' });

            const aiAnswer = await fetchAIAnswer(aiPrompt);

            const replyText = aiAnswer && typeof aiAnswer === 'string' ? aiAnswer : 'No personal info found';

            await client.sendMessage(remoteJid, {
                text: replyText,
                quoted: message
            });

            // record the reply time
            lastReplyMap.set(remoteJid, Date.now());
            console.log(`✅ AI auto-reply sent to ${remoteJid}`);
        } catch (err) {
            console.error('❌ Error fetching AI answer for autoReply:', err?.message || err);
        }
    } catch (error) {
        console.error("❌ Error in autoReply command:", error.message);
    }
}

export default autoReply;