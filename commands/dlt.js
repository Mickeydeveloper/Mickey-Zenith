import sender from "../commands/sender.js";

async function dlt(message, client) {

    try {

        const quotedMessageInfo = message.message?.extendedTextMessage?.contextInfo;

        if (!quotedMessageInfo || !quotedMessageInfo.quotedMessage) {

            sender(message, client, "❌ Please reply to a message to delete it.");

            return;
        }

        const chatId = message.key.remoteJid;

        const quotedMessageKey = quotedMessageInfo.stanzaId;

        const quotedSender = quotedMessageInfo.participant;
        
        const isFromBot = quotedSender === client.user.id;

        if (!quotedMessageKey || !chatId) {

            sender(message, client, "❌ Could not find the message to delete.");
            
            return;
        }

        console.log(`🗑 Attempting to delete message ID: ${quotedMessageKey} in ${chatId}`);

        // 1️⃣ First, attempt to delete the message for everyone
        try {

            await client.sendMessage(remoteJid, { delete: quotedMessageKey });

            console.log("✅ Message deleted for everyone.");

            return;

        } catch (error) {
            console.error("⚠️ Could not delete for everyone, attempting self-deletion...");
        }

        // 2️⃣ If deletion for everyone fails, delete only for the bot itself
        try {
            await client.chatModify(
                { clear: { messages: [{ id: quotedMessageKey, fromMe: isFromBot }] } },
                chatId
            );
            console.log("✅ Message deleted for self.");
        } catch (error) {
            console.error("❌ Failed to delete for self too:", error);
            sender(message, client, "❌ Unable to delete the message.");
        }

    } catch (error) {
        console.error("❌ Error deleting message:", error);
        sender(message, client, "❌ Failed to delete the message.");
    }
}

export default dlt;
