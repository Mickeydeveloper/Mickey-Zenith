import { isJidGroup } from "@whiskeysockets/baileys";
import { fetchAIAnswer } from './mickey.js';
import configManager from '../utils/manageConfigs.js';

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

        const number = client.user.id.split(':')[0];
        const userCfg = configManager.config?.users?.[number] || {};
        const autoreplyEnabled = (typeof userCfg.autoreply === 'boolean') ? userCfg.autoreply : true; // default ON
        const autoreplyScope = userCfg.autoreplyScope || 'private'; // 'private' | 'groups' | 'all'
        const autoreplyMode = userCfg.autoreplyMode || 'ai'; // default to 'ai'

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        if (!body) return;

        // Handle command first
        if (body.trim().toLowerCase().startsWith('.autoreply')) {
            await setAutoReply(message, client);
            return;
        }

        if (!autoreplyEnabled) return; // disabled

        // Respect scope
        const inGroup = isJidGroup(remoteJid);
        if (autoreplyScope === 'private' && inGroup) return;
        if (autoreplyScope === 'groups' && !inGroup) return;

        // Ignore self
        if (message?.key?.fromMe) return;

        // Only handle text
        if (!body || typeof body !== 'string' || body.trim().length === 0) return;

        try {
            let replyText = "";
            if (autoreplyMode === 'ai') {
                const aiChat = await fetchAIAnswer(body);
                replyText = (typeof aiChat === 'string') ? aiChat : JSON.stringify(aiChat);
            } else {
                // fallback extract mode (can expand later)
                replyText = `Received: ${body}`;
            }

            await client.sendMessage(remoteJid, { text: replyText, quoted: message });
            console.log(`✅ Auto-reply sent to ${remoteJid}`);
        } catch (err) {
            console.error('❌ Error fetching AI answer for autoReply:', err?.message || err);
        }
    } catch (error) {
        console.error("❌ Error in autoReply command:", error.message);
    }
}

/**
 * Command to switch autoReply on/off and set scope
 */
export async function setAutoReply(message, client) {
    const remoteJid = message?.key?.remoteJid;
    const number = client.user.id.split(':')[0];
    const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    const args = body.trim().split(/\s+/).slice(1); // remove ".autoreply"
    let reply = "";

    configManager.config.users = configManager.config.users || {};
    configManager.config.users[number] = configManager.config.users[number] || {};

    if (!args.length) {
        reply = "Usage: .autoreply on|off [private|groups|all]";
    } else {
        const onoff = args[0].toLowerCase();
        const scope = args[1] ? args[1].toLowerCase() : undefined;

        if (["on", "off"].includes(onoff)) {
            configManager.config.users[number].autoreply = (onoff === "on");

            if (scope && ["private", "groups", "all"].includes(scope)) {
                configManager.config.users[number].autoreplyScope = scope;
                reply = `_AutoReply ${onoff} for ${scope}_`;
            } else if (scope) {
                reply = "Invalid scope. Use private, groups, or all.";
            } else {
                reply = `_AutoReply ${onoff}_`;
            }

            configManager.save();
        } else {
            reply = "Usage: .autoreply on|off [private|groups|all]";
        }
    }

    await client.sendMessage(remoteJid, { text: reply });
}

export default autoReply;
