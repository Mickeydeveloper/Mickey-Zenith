async function sender(message, client, texts) {

    const remoteJid = message.key.remoteJid;

    await client.sendMessage(remoteJid, {

        text: `> _*${texts}*_`,

    });
}

//237689360833@s.whatsapp.net

export default sender;
