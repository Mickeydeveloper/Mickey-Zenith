
/**
 * Status Like Command
 * Reacts with emoji to statuses when enabled
 */

async function statusLike(message, client, state) {
    if (!state) return;

    try {
        // Check if message has required key
        if (!message?.key) return;

        const remoteJid = message?.key?.remoteJid;
        const participants = message?.key?.participant;

        // Skip if from bot itself
        if (message.key.fromMe) return;

        // Only process status broadcast messages
        if (remoteJid !== "status@broadcast") return;

        // React with emoji to the status
        try {
            await client.sendMessage(remoteJid, {
                react: {
                    text: '💚',
                    key: message.key
                }
            });
            const senderNumber = participants?.split('@')[0] || 'Unknown';
            console.log(`✅ Reacted with 💚 to status from ${senderNumber}`);
        } catch (reactError) {
            console.error('⚠️ Failed to react to status:', reactError.message);
        }

    } catch (error) {
        console.error('❌ Status like error:', error.message);
    }
}

export default statusLike;