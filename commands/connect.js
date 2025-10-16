
import startSession from '../utils/connector.js'


import handleIncomingMessage from '../events/messageHandler.js';

async function connect(message, client) {

    let targetNumber;

    const remoteJid = message.key.remoteJid;

    if (remoteJid.endsWith("g.us")) return await client.sendMessage(remoteJid, {text:"_This command can't be used in groups._"})

    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {

        targetNumber = message.message.extendedTextMessage.contextInfo.participant;

    } else {

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const parts = messageBody.split(/\s+/);

        targetNumber = parts[1];
    }

    if (!targetNumber) {

        sender(message, client, "❌ Please provide a number or reply to a message to connect.");

        return;
    }

    targetNumber = targetNumber.replace('@s.whatsapp.net', '').trim();

    console.log("Checking connection for:", targetNumber);

    await startSession(targetNumber, handleIncomingMessage, true);

}

export default { connect };
