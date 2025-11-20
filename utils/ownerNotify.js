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
        // Avoid generating link previews which require the optional 'link-preview-js' package
        const sendOptions = Object.assign({ text }, options);
        // If caller did not explicitly opt into preview generation, disable link detection
        if (sendOptions.detectLinks === undefined) sendOptions.detectLinks = false;

        await client.sendMessage(ownerJid, sendOptions);
        console.log('Owner notification sent successfully');
    } catch (error) {
        // Fallback: try sending a minimal plain-text message without extra options
        try {
            const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
            await client.sendMessage(ownerJid, { text: String(text).slice(0, 2000), detectLinks: false });
            console.log('Owner notification sent (fallback)');
            return;
        } catch (err2) {
            console.error('Failed to notify owner (fallback):', err2?.message || err2);
        }
        console.error('Failed to notify owner:', error?.message || error);
    }
}

export default notifyOwner;