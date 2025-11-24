import { OWNER_NUM } from '../config.js';
import fs from 'fs';
import path from 'path';

const QUEUE_PATH = path.join(process.cwd(), 'owner-notify-queue.json');

function loadQueue() {
    try {
        if (fs.existsSync(QUEUE_PATH)) {
            return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')) || [];
        }
    } catch (e) {
        console.debug('ownerNotify: failed to load queue', e?.message || e);
    }
    return [];
}

function saveQueue(queue) {
    try {
        fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
    } catch (e) {
        console.debug('ownerNotify: failed to save queue', e?.message || e);
    }
}

/**
 * Send a notification to the bot owner. If the WhatsApp client is not available
 * or the connection is closed, the message will be queued and flushed later
 * when a session opens.
 * @param {Object} client - The WhatsApp client instance (may be null)
 * @param {string} text - The message to send
 * @param {Object} options - Additional options for sendMessage
 */
export async function notifyOwner(client, text, options = {}) {
    const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
    // Basic validation: client must have sendMessage function
    if (!client || typeof client.sendMessage !== 'function') {
        console.debug('ownerNotify: client not available, queuing message');
        const q = loadQueue();
        q.push({ ownerJid, text, options, ts: Date.now() });
        saveQueue(q);
        return;
    }

    try {
        await client.sendMessage(ownerJid, { text, ...options });
        console.log('Owner notification sent successfully');
    } catch (error) {
        const errMsg = String(error?.message || error);
        // If connection closed or network error, queue the message instead of erroring loudly
        if (/connection closed|not connected|socket closed|ECONNRESET|ENOTFOUND/i.test(errMsg)) {
            console.warn('ownerNotify: connection closed - queueing owner notification');
            const q = loadQueue();
            q.push({ ownerJid, text, options, ts: Date.now(), err: errMsg });
            saveQueue(q);
            return;
        }
        console.error('Failed to notify owner:', errMsg);
    }
}

/**
 * Flush queued owner notifications using the provided client.
 * Will attempt to send all queued messages and remove those sent.
 */
export async function flushQueuedNotifications(client) {
    if (!client || typeof client.sendMessage !== 'function') return;
    const q = loadQueue();
    if (!q.length) return;

    const remaining = [];
    for (const item of q) {
        try {
            await client.sendMessage(item.ownerJid, { text: item.text, ...(item.options || {}) });
            console.log('ownerNotify: flushed queued notification');
        } catch (e) {
            const errMsg = String(e?.message || e);
            console.debug('ownerNotify: failed to flush queued message', errMsg);
            // keep in queue for retry
            remaining.push(item);
        }
    }

    saveQueue(remaining);
}

export default notifyOwner;