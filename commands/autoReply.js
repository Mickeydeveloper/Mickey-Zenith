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
        const autoreplyEnabled = (typeof userCfg.autoreply === 'boolean') ? userCfg.autoreply : false; // default OFF
        // Make default scope 'all' so replies work without typing `.autoreply on`
        const autoreplyScope = userCfg.autoreplyScope || 'all'; // 'private' | 'groups' | 'all'
        // Use configured prefix if available so commands are detected correctly
        const prefix = configManager?.config?.users?.[number]?.prefix || '.';
        const autoreplyMode = userCfg.autoreplyMode || 'ai'; // default to 'ai'

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        if (!body) return;

        // Handle command first (use configured prefix)
        if (body.trim().toLowerCase().startsWith((prefix + 'autoreply').toLowerCase())) {
            await setAutoReply(message, client);
            return;
        }

        // Don't auto-reply to commands (messages starting with the prefix)
        if (body.trim().startsWith(prefix)) return;

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
    // support: .autoreply status
    const userCfg = configManager.config.users[number] || {};
    const currentEnabled = (typeof userCfg.autoreply === 'boolean') ? userCfg.autoreply : false;
    const currentScope = userCfg.autoreplyScope || 'all';
    const currentMode = userCfg.autoreplyMode || 'ai';
    const currentPrefix = configManager?.config?.users?.[number]?.prefix || '.';

    if (!args.length) {
        reply = "Usage: .autoreply on|off [private|groups|all] or .autoreply status";
    } else if (args[0].toLowerCase() === 'status') {
        reply = `AutoReply Status:\n- Enabled: ${currentEnabled}\n- Scope: ${currentScope}\n- Mode: ${currentMode}\n- Prefix: ${currentPrefix}`;
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
            reply = "Usage: .autoreply on|off [private|groups|all] or .autoreply status";
        }
    }

    await client.sendMessage(remoteJid, { text: reply });
}

export default autoReply;
