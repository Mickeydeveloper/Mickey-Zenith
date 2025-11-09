
import autoJoin from '../utils/autoJoin.js';
import { DisconnectReason } from '@whiskeysockets/baileys';

function handleConnectionUpdate(update, reconnect, sock) {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) reconnect();
    } else if (connection === 'open') {
        console.log(`\u2705 WhatsApp connection opened at ${new Date().toLocaleString()}`);
        
        // Attempt to join the target group when connection is established
        autoJoin(sock).catch(err => {
            console.error('Failed to auto-join target group:', err.message);
        });
    }
}

export default handleConnectionUpdate;
