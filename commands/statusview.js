/**
 * Status View Command
 * Views/Marks statuses as read when enabled
 */

async function statusView(message, client, state) {
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

        // Mark status as viewed/read
        try {
            await client.readMessages([message.key]);
            const senderNumber = participants?.split('@')[0] || 'Unknown';
            console.log(`✅ Status viewed from ${senderNumber}`);
        } catch (readError) {
            console.error('⚠️ Failed to read status:', readError.message);
        }

    } catch (error) {
        console.error('❌ Status view error:', error.message);
    }
}

export default statusView;
