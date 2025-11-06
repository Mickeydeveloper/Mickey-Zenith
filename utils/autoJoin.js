// autoJoin.js
// Accepts either a raw id/jid or a WhatsApp invite link (https://chat.whatsapp.com/XXXX)
async function autoJoin(sock, channelId, cont) {

    // Helper: if provided a chat.whatsapp.com link, extract the invite code.
    const parseChannelId = (input) => {
        if (!input) return input;
        const s = String(input).trim();
        // match chat.whatsapp.com/<code>
        const m = s.match(/(?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/(\w[-\w]*)/i);
        if (m && m[1]) return m[1];
        // if looks like a jid or numeric id, return as-is
        return s;
    };

    const parsed = parseChannelId(channelId);

    // If the input was a chat link, 'parsed' will be the invite code; otherwise it's the raw id/jid.
    // We keep using variable name 'jid' for backwards compat, but note it may be an invite code.
    const jid = parsed;

    const queryId = '12036339810636029'; // Replace with actual query ID if needed

    const encoder = new TextEncoder();

    const server = 's.whatsapp.net';

    const joinNode = {

        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            xmlns: 'w:mex',
            to: server,
        },
        content: [
            {
                tag: 'query',
                attrs: { 'query_id': queryId },
                content: encoder.encode(JSON.stringify({
                    variables: {
                        newsletter_id: jid,
                        ...(cont || {})
                    }
                }))
            }
        ]
    };

    const fetchNode = {
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            xmlns: 'newsletter',
            to: server,
        },
        content: [
            {
                tag: 'messages',
                attrs: {
                    type: 'jid',
                    jid: jid,
                    count: '1'
                },
                content: [] // never use null here
            }
        ]
    };

    try {
        // If we received an invite code (from a chat.whatsapp.com link), log that we detected a link.
        if (typeof channelId === 'string' && /chat\.whatsapp\.com\//i.test(channelId)) {
            console.log(`Detected invite link. Using invite code: ${jid}`);
        }

        const joinResponse = await sock.query(joinNode);
        console.log(`✅ Sent join request: ${jid}`, joinResponse);

    } catch (err) {
        console.error('❌ Error in autoJoin function:', err);
    }
};

export default autoJoin;
