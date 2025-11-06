
import configManager from '../utils/manageConfigs.js';

export async function autorecord(message, client) {

    const remoteJid = message.key.remoteJid;

    const number = client.user.id.split(':')[0];

    const state = configManager.config?.users[number]?.record;

    if (state) {

        await client.sendPresenceUpdate('recording', remoteJid);


        setTimeout(async () => {

            await client.sendPresenceUpdate('available', remoteJid);

        }, 5000); // 5000ms = 5s

    }
}

export async function autotype(message, client) {

    const remoteJid = message.key.remoteJid;

    const number = client.user.id.split(':')[0];

    const state = configManager.config?.users[number]?.type;

    if (state) {

        // Start typing simulation
        await client.sendPresenceUpdate('composing', remoteJid);

        // Simulate for 5 seconds (adjust if needed)
        setTimeout(async () => {
            // Stop typing
            await client.sendPresenceUpdate('available', remoteJid);

        }, 5000);
    }


}

export default {autorecord, autotype};
