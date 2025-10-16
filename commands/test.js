
export async function test(message, client) {

    const remoteJid = message.key.remoteJid;

    try {
        if (!remoteJid.includes('@g.us')) {
            await client.sendMessage(remoteJid, { text: '_This command only works in group chats._' });
            return;
        }

        // Fetch group metadata
        const groupMetadata = await client.groupMetadata(remoteJid);
        const participants = groupMetadata.participants.map(user => user.id);

        const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

        const commandAndArgs = messageBody.slice(1).trim();
        const parts = commandAndArgs.split(/\s+/);
        const text = parts.slice(1).join(' ') || '\u200B';

        // Check if the message is quoting another message
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            // If quoted message is a sticker, forward it
            if (quotedMessage.stickerMessage) {
                const sticker = quotedMessage.stickerMessage;
                await client.sendMessage(remoteJid, { sticker, mentions: participants });
                return;
            }

            // If quoted message is text, reply with mentions
            const quotedText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || "";
            await client.sendMessage(remoteJid, { text: `${quotedText}`, mentions: participants });
            return;
        }

        // Default behavior (no quoted message)
        await client.sendMessage(remoteJid, { text: `${text}`, mentions: participants });

    } catch (error) {
        console.error("_Error mentioning all:_", error);
    }
}

export default test