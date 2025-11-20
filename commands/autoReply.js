import { isJidGroup } from "@whiskeysockets/baileys";
import { fetchAIAnswer } from './mickey.js';
import configManager from '../utils/manageConfigs.js';

// NOTE: Removed per-sender cooldown and greeting checks as requested.
// When autoreply is enabled the bot will answer any incoming text message (respecting scope).

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

        // Check per-session autoreply config
        const number = client.user.id.split(':')[0];
        const userCfg = configManager.config?.users?.[number] || {};
        const autoreplyEnabled = (typeof userCfg.autoreply === 'boolean') ? userCfg.autoreply : true; // default on
        const autoreplyScope = userCfg.autoreplyScope || 'private'; // 'private' | 'groups' | 'all'
        const autoreplyMode = userCfg.autoreplyMode || 'extract'; // 'extract' | 'ai'

        if (!autoreplyEnabled) {
            // Auto-reply disabled for this session
            return;
        }

        // Respect scope setting
        const inGroup = isJidGroup(remoteJid);
        if (autoreplyScope === 'private' && inGroup) return;
        if (autoreplyScope === 'groups' && !inGroup) return;

        // Ignore messages sent by this bot (avoid loops)
        if (message?.key?.fromMe) return;

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        // Only handle text messages with some content
        if (!body || typeof body !== 'string' || body.trim().length === 0) return;

        // Build a robust prompt asking the AI to return strict JSON including an "assistance" field
        // The AI should return a single JSON object like: {"name":..,"phone":..,"info":..,"assistance":..}
        // Use null for absent fields. "assistance" should be a short helpful suggestion or summary.
        const aiPrompt = `You are an assistant that extracts personal information and provides concise help.\nFrom the user text below, extract up to three fields: name, phone, info. Also provide a short "assistance" message that either suggests next steps or summarizes the text.\nReturn ONLY a single valid JSON object with keys exactly: name, phone, info, assistance. Use null for missing fields. Do NOT return any extra commentary.\n\nUser text:\n"${body.replace(/"/g, '\\"')}"`;

        try {
            // Optional thinking indicator (comment out to reduce messages)
            // await client.sendMessage(remoteJid, { text: '⏳ Processing your message…' });

            // If mode is 'ai', call the AI with the raw message and send back the chat-style reply
            // Call the AI API with the raw message text and send its reply as plain text
            const aiChat = await fetchAIAnswer(body);
            const chatReply = (typeof aiChat === 'string') ? aiChat : JSON.stringify(aiChat);
            await client.sendMessage(remoteJid, { text: chatReply, quoted: message });
            console.log(`✅ AI auto-reply (API) sent to ${remoteJid}`);

            // no cooldown tracking — replies are sent for every incoming text when enabled
            console.log(`✅ AI auto-reply sent to ${remoteJid}`);
        } catch (err) {
            console.error('❌ Error fetching AI answer for autoReply:', err?.message || err);
        }
    } catch (error) {
        console.error("❌ Error in autoReply command:", error.message);
    }
}

export default autoReply;
