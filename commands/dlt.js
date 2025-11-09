import sender from "../commands/sender.js";

/**
 * Delete a quoted message. Works for private and group chats.
 * The function will attempt to delete the quoted message for everyone by
 * sending a delete payload. If it fails, it will report the failure.
 */
async function dlt(message, client) {
    try {
        const ctx = message.message?.extendedTextMessage?.contextInfo;

        if (!ctx || !ctx.quotedMessage) {
            // Not a reply
            await sender(message, client, "❌ Please reply to a message to delete it.");
            return;
        }

        const chatId = message.key.remoteJid;
        const stanzaId = ctx.stanzaId || ctx.id || (ctx.quotedMessage && ctx.quotedMessage.key && ctx.quotedMessage.key.id);
        const participant = ctx.participant || (ctx.quotedMessage && ctx.quotedMessage.key && ctx.quotedMessage.key.participant) || undefined;

        if (!stanzaId || !chatId) {
            await sender(message, client, "❌ Could not determine the message to delete.");
            return;
        }

        // Build a proper message key object similar to message.key
        const quotedKey = { remoteJid: chatId, id: stanzaId, participant };

        console.log(`🗑 Attempting to delete message ${stanzaId} in ${chatId}`);

        try {
            // Ask WhatsApp to delete the quoted message
            await client.sendMessage(chatId, { delete: quotedKey });

            // Optionally confirm to user (silence on success to be less noisy)
            // await sender(message, client, '✅ Message deleted.');
            return;
        } catch (err) {
            console.error('⚠️ Failed to delete message for everyone:', err);
            await sender(message, client, '❌ Unable to delete the message for everyone.');
            return;
        }
    } catch (error) {
        console.error('❌ Error in dlt command:', error);
        try { await sender(message, client, '❌ Failed to delete the message.'); } catch (e) { /* ignore */ }
    }
}

export default dlt;
