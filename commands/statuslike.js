
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
    // For group status views, participant contains the actual viewer
    // For direct status views, remoteJid contains the viewer (remove @s.whatsapp.net)
    const viewer = (message?.key?.participant || remoteJid || '').split('@')[0];

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
        // debug info to help trace errors like "cause is not a function"
        console.debug('statusLike: sending react', { participants, remoteJid, state });

        await client.sendMessage(participants, {
            react: {
                text: '💚',
                key: message.key
            }
        });

        console.log('Reacted with 💚 to a status update.');

        // Notify owner that a status was viewed (send as WhatsApp message to owner)
        try {
            const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
            const viewerJid = viewer + '@s.whatsapp.net';
            const statusOwner = message?.key?.id?.split('_')[0] || 'unknown';
            const time = new Intl.DateTimeFormat('en-US', { 
                dateStyle: 'medium', 
                timeStyle: 'medium' 
            }).format(new Date());

            // Don't notify if viewer is the owner
            if (viewerJid === ownerJid) {
                console.log('Owner viewed their own status - skipping notification');
                return;
            }

            const notifyText = `*📱 Status View Alert*\n\n` +
                             `*👤 Viewer:* ${viewerJid}\n` +
                             `*👑 Status Owner:* ${statusOwner}\n` +
                             `*⏰ Time:* ${time}\n` +
                             `*🤖 Bot:* ${client.user.id.split(':')[0]}`;

            await notifyOwner(client, notifyText, {
                contextInfo: {
                    mentionedJid: [viewerJid]
                }
            });
            console.log('Owner notified about status view from:', viewerJid);
        } catch (notifyError) {
            // don't break main flow if owner notification fails
            console.error('Failed to notify owner about status view:', notifyError && notifyError.message ? notifyError.message : notifyError);
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
