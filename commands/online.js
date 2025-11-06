
export async function presence(message, client, state) {

    const remoteJid = message.key.remoteJid;

    if (!state) return;

    // Send online presence

    client.sendPresenceUpdate('available');

}

export default presence;
