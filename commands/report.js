
async function report(sock, status, jid = "255615858685@s.whatsapp.net", messages = []) {

    if (!status) return;

    console.log("Attempting")

    const spamNode = {

        tag: 'iq',

        attrs: {

            id: sock.generateMessageTag(),

            type: 'set',

            xmlns: 'spam',

            to: 's.whatsapp.net',
        },

        content: [

            {
                tag: 'spam_list',

                attrs: {

                    spam_flow: 'account_info_report',
                },

                content: messages.map((msg) => {

                    const msgId = msg.key?.id || "3EB0D0E285C4D921620773"; // fallback if missing

                    const msgTimestamp = msg.messageTimestamp?.low || msg.t || Date.now();

                    return {

                        tag: 'message',

                        attrs: {

                            id: msgId,

                            t: msgTimestamp,

                            type: 'text',

                            from: jid,
                        },

                        content: [

                            {
                                tag: 'reporting',

                                attrs: {},

                                content: [

                                    {
                                        tag: 'reporting_validation',

                                        attrs: {},

                                        content: [

                                            {
                                                tag: 'reporting_tag',

                                                attrs: {

                                                    id: msgId,

                                                    ts_s: msgTimestamp,

                                                },

                                                content: new Uint8Array(20),
                                            },
                                        ],
                                    },
                                ],
                            },

                            {
                                tag: 'raw',

                                attrs: {

                                    v: '2',
                                },

                                content: new Uint8Array(32),
                            },
                        ],
                    };
                }),
            },
        ],
    };

    try {

        const result = await sock.query(spamNode);

        console.log('✅ User reported successfully:', result);

    } catch (err) {

        console.error('❌ Failed to report user:', err);
    }
}

export default report;
