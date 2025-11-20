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

            const aiAnswer = await fetchAIAnswer(aiPrompt);

            let parsed = null;
            if (typeof aiAnswer === 'string') {
                try {
                    parsed = JSON.parse(aiAnswer.trim());
                } catch (jsonErr) {
                    // Fallback: attempt to parse loosely, or treat whole answer as assistance
                    const nameMatch = aiAnswer.match(/"?name"?\s*[:\-]\s*"?([^"\n]+)"?/i);
                    const phoneMatch = aiAnswer.match(/"?phone"?\s*[:\-]\s*"?([+0-9\-() ]{6,})"?/i);
                    const infoMatch = aiAnswer.match(/"?info"?\s*[:\-]\s*"?([^"\n]+)"?/i);
                    const assistanceMatch = aiAnswer.match(/"?assistance"?\s*[:\-]\s*"?([^"\n]+)"?/i);

                    parsed = {
                        name: nameMatch ? nameMatch[1].trim() : null,
                        phone: phoneMatch ? phoneMatch[1].trim() : null,
                        info: infoMatch ? infoMatch[1].trim() : null,
                        assistance: assistanceMatch ? assistanceMatch[1].trim() : (aiAnswer.trim() || null)
                    };
                }
            }

            // Build reply text; always include an assistance/suggestion line
            const hasInfo = parsed && (parsed.name || parsed.phone || parsed.info);
            let replyText = '';
            if (hasInfo) {
                replyText += `Name: ${parsed.name || 'N/A'}\nPhone: ${parsed.phone || 'N/A'}\nInfo: ${parsed.info || 'N/A'}`;
            }

            const assistance = parsed && parsed.assistance ? parsed.assistance : 'I could not find personal info — how can I help?';
            replyText += (replyText ? '\n\n' : '') + `Assistance: ${assistance}`;

            await client.sendMessage(remoteJid, {
                text: replyText,
                quoted: message
            });

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
