
import { OWNER_NUM } from '../config.js'
import notifyOwner from '../utils/ownerNotify.js';

async function statusLike(message, client, state) {
    // defensive checks to avoid runtime errors and to help debugging
    if (!message || !message.key) {
        console.warn('statusLike: missing message or message.key');
        return;
    }

    // Extract user number from message for config lookup
    const userJid = message.key?.remoteJid?.split('@')[0];
    
    // Debug logging to help track the flow
    console.log('statusLike called:', { 
        userJid,
        state,
        type: message.type,
        messageType: message.messageType,
        fromMe: message?.key?.fromMe
    });

    const remoteJid = message?.key?.remoteJid;
    // For group status views, `message.key.participant` contains the actual viewer JID.
    // For direct status views there's no participant; try to use message.sender if available.
    const viewerJidFull = message?.key?.participant || message?.message?.sender || null;
    const viewer = viewerJidFull ? viewerJidFull.split('@')[0] : null;

    // ensure we have the right shape and it's a status
    if (!remoteJid || remoteJid !== 'status@broadcast') {
        console.warn('statusLike: not a status update or missing remoteJid', { remoteJid });
        return;
    }

    if (!viewer) {
        console.warn('statusLike: could not determine viewer', { participant: message?.key?.participant, remoteJid });
        return;
    }

    if (message?.key?.fromMe) return; // don't react to own status

    try {
        // debug info to help trace errors
        console.debug('statusLike: sending react', { viewer, remoteJid, state });

        // For status updates the chat JID is usually 'status@broadcast'.
        // Send the reaction to the status broadcast using the original message key.
        const reactTargetJid = remoteJid || 'status@broadcast';

        await client.sendMessage(reactTargetJid, {
            react: {
                text: state ? '💚' : '👍',
                key: message.key
            }
        });

        console.log('Reacted to a status update.');

        // Notify owner that a status was viewed (send as WhatsApp message to owner)
        try {
            const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
            const viewerJid = (viewerJidFull || viewer) ? (viewerJidFull || (viewer + '@s.whatsapp.net')) : 'unknown@s.whatsapp.net';

            // helper: try to resolve a display name for a jid using client.onWhatsApp (falls back to jid local part)
            async function resolveDisplayName(jid) {
                try {
                    if (!jid) return 'unknown';
                    const id = jid.split('@')[0];
                    if (typeof client.onWhatsApp === 'function') {
                        const result = await client.onWhatsApp(id);
                        const contact = Array.isArray(result) && result.length ? result[0] : null;
                        if (contact && (contact.notify || contact.pushname)) return contact.notify || contact.pushname;
                    }
                    // final fallback: local part of jid
                    return jid.split('@')[0];
                } catch (e) {
                    return jid.split('@')[0] || 'unknown';
                }
            }

            // determine status owner jid & name (best-effort)
            const rawStatusId = message?.key?.id || '';
            const statusOwnerLocal = rawStatusId.split('_')[0] || '';
            const statusOwnerJid = statusOwnerLocal ? `${statusOwnerLocal}@s.whatsapp.net` : 'unknown@s.whatsapp.net';

            const [viewerName, statusOwnerName] = await Promise.all([
                resolveDisplayName(viewerJid),
                resolveDisplayName(statusOwnerJid)
            ]);

            const time = new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'medium'
            }).format(new Date());

            // Don't notify if viewer is the owner
            if (viewerJid === ownerJid) {
                console.log('Owner viewed their own status - skipping notification');
            } else {
                const notifyText = `*📱 Status View Alert*\n\n` +
                                 `*👤 Viewer:* ${viewerName} \n` +
                                 `*🆔 Viewer JID:* ${viewerJid} \n` +
                                 `*👑 Status Owner:* ${statusOwnerName} \n` +
                                 `*🆔 Owner JID:* ${statusOwnerJid} \n` +
                                 `*⏰ Time:* ${time} \n` +
                                 `*🤖 Bot:* ${client.user?.id?.split(':')[0] || 'unknown'}`;

                // send notification but don't block the main flow
                notifyOwner(client, notifyText, {
                    contextInfo: {
                        mentionedJid: [viewerJid]
                    }
                }).catch(err => console.error('Failed to notify owner about status view:', err));

                console.log('Owner notified about status view from:', viewerJid, viewerName);
            }
        } catch (notifyError) {
            // don't break main flow if owner notification fails
            console.error('Failed to prepare/notify owner about status view:', notifyError && notifyError.message ? notifyError.message : notifyError);
        }
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
