import { OWNER_NUM } from '../config.js';

/**
 * Send a notification to the bot owner
 * @param {Object} client - The WhatsApp client instance
 * @param {string} text - The message to send
 * @param {Object} options - Additional options (e.g., mentionedJid)
 */
export async function notifyOwner(client, text, options = {}) {
    try {
        const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
        await client.sendMessage(ownerJid, { 
            text,
            ...options
        });
        console.log('Owner notification sent successfully');
    } catch (error) {
        console.error('Failed to notify owner:', error?.message || error);
    }
}

export default notifyOwner;