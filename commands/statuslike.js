
async function statusLike(message, client, state) {

    if (!state) return;

    try {

        const remoteJid = message?.key?.remoteJid;

        const participants = message?.key?.participant;

        if (message.key.fromMe) return;

        if (remoteJid !== "status@broadcast") return;

        await client.sendMessage(participants, {

            react: {

                text: '💚',

                key: message.key
            }
        });

        console.log('Reacted with 💚 to a status update.');

    } catch (error) {

        console.error('Failed to react to status:', error);
    }
}

export default statusLike;
