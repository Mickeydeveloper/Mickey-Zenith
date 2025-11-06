
function handleConnectionUpdate(update, reconnect) {

    const { connection, lastDisconnect } = update;

    if (connection === 'close') {

        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) reconnect();

    } else if (connection === 'open') {
        
        console.log(`\u2705 WhatsApp connection opened at ${new Date().toLocaleString()}`);
    }
}

module.exports = handleConnectionUpdate;
