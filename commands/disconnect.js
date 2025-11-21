
import fs from 'fs';

import path from 'path';

import sender from '../commands/sender.js';

async function disconnect(message, client) {

        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) {

            throw new Error("Message JID is undefined.");
        }

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim();

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1);

        let participant;

        // Handle reply to message
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {

            participant = `${message.message.extendedTextMessage.contextInfo}`;

            participant = `${participant}`.replace('@s.whatsapp.net', ''); 

        } else if (args.length > 0) {

            participant = args[0];

        } else {

            throw new Error('Specify the person to disconnect.');
        }

        const num = '@' + participant.replace('@s.whatsapp.net', '')

    const sessionPath = path.join(`./sessions/${participant}`);

    if (fs.existsSync(sessionPath)) {

        try {

            fs.rmdirSync(sessionPath, { recursive: true });

            sender(message, client, `✅ Auth information for ${participant} deleted successfully.`);

        } catch (error) {

            sender(message, client,`❌ Error deleting auth info for ${participant}:`, error);
        }

    } else {

        sender(message, client, `❌ No auth information found for ${participant}.`);
    }
}

export default disconnect;
