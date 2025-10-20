
async function statusLike(message, client, state) {

    // state is expected to be truthy (enabled) for this feature
    if (!state) return;

    // defensive checks to avoid runtime errors and to help debugging
    if (!message || !message.key) {
        console.warn('statusLike: missing message or message.key');
        return;
    }

    const remoteJid = message?.key?.remoteJid;
    const participants = message?.key?.participant;

    // ensure we have the right shape
    if (!remoteJid) {
        console.warn('statusLike: message.key.remoteJid is missing');
        return;
    }

    if (remoteJid !== 'status@broadcast') return; // not a status update

    if (!participants || typeof participants !== 'string') {
        console.warn('statusLike: invalid participants value', participants);
        return;
    }

    if (message?.key?.fromMe) return; // don't react to own status

    try {
        // debug info to help trace errors like "cause is not a function"
        console.debug('statusLike: sending react', { participants, remoteJid, state });

        await client.sendMessage(participants, {
            react: {
                text: '💚',
                key: message.key
            }
        });

        console.log('Reacted with 💚 to a status update.');
    } catch (error) {
        // Log full stack and inspect possible .cause property without calling it
        try {
            console.error('Failed to react to status:', error && error.message ? error.message : error);
            if (error && error.stack) console.error(error.stack);
            // if a property named `cause` exists, log its type/value safely
            if (error && Object.prototype.hasOwnProperty.call(error, 'cause')) {
                console.error('error.cause type:', typeof error.cause, 'value:', error.cause);
            }
        } catch (logErr) {
            // ensure we never call any unknown property as a function here
            console.error('Failed to log error in statusLike catch block:', logErr);
        }
    }
}

export default statusLike;
