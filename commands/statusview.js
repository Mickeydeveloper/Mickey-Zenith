/**
 * Status View Command
 * Views/Marks statuses as read when enabled
 */

async function statusView(message, client, state = true) {
    // Treat undefined state as enabled (always-on)
    if (state === false) return;

    // Minimal checks and fast exit for non-status messages
    if (!message?.key || message.key.fromMe) return;
    const remoteJid = message?.key?.remoteJid;
    if (remoteJid !== 'status@broadcast') return;

    try {
        // Mark status as viewed/read. Keep this short and swallow non-critical errors.
        await client.readMessages([message.key]);
    } catch (err) {
        // Non-fatal: log debug only
        console.debug('statusView: failed to mark as read', err?.message || err);
    }
}

export default statusView;
