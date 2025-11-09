
const statuslike = {
    async handleStatus(message, client, state) {
        if (!state) return;

        try {
            // Check if it's a valid message
            if (!message?.key) return;

            const remoteJid = message.key.remoteJid;
            const sender = message.key.participant || message.participant || message.key.remoteJid;
            
            // Only proceed if it's a status message and not from the bot itself
            if (message.key.fromMe) return;
            if (remoteJid !== "status@broadcast") return;
            if (!sender) return;

            // Get sender's name or number for notification
            const senderNumber = sender.split('@')[0];
            
            // View the status immediately
            await client.readMessages([message.key]);

            // React to the status
            await Promise.all([
                // Send reaction
                client.sendMessage(remoteJid, {
                    react: {
                        text: '💚',
                        key: message.key
                    }
                }),
                
                // Notify owner about the new status
                client.sendMessage(client.user.id, {
                    text: `📱 New Status Detected!\n\nFrom: ${senderNumber}\nTime: ${new Date().toLocaleString()}\n\nStatus has been viewed and liked automatically 💚`
                })
            ]);

            console.log(`Status from ${senderNumber} viewed and reacted with 💚`);

        } catch (error) {
            // Notify owner about any errors
            try {
                await client.sendMessage(client.user.id, {
                    text: `❌ Status Error!\n\nError: ${error.message}\nFrom: ${sender?.split('@')[0] || 'Unknown'}`
                });
            } catch (notifyError) {
                console.error('Failed to notify owner about error:', notifyError);
            }
            console.error('Failed to handle status:', error);
        }
    }
};

export default statuslike;