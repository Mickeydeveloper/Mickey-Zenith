
export async function modifyprem(message, client, list, action) {

    try {
        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) throw new Error("Invalid remote JID.");

        // Normalize command input
        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim(); // Remove prefix and trim

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1); // Extract arguments

        let participant;

        // Handle reply to message
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {

            participant = message.message?.extendedTextMessage?.contextInfo?.participant || message.key.participant;

        } else if (args.length > 0) {

            const jidMatch = args[0].match(/\d+/); // Extract numbers only

            if (!jidMatch) throw new Error("Invalid participant format.");

            participant = jidMatch[0] + '@s.whatsapp.net';

        } else {

            throw new Error("No participant specified.");
        }

        if (action === "add") {

            if (!list.includes(participant)) {

                list.push(participant);

            } else {

                return

            }

        } else if (action === "remove") {

            const index = list.indexOf(participant);

            if (index !== -1) {

                list.splice(index, 1);


            } else {

            }
        }
    } catch (error) {

        console.error("Error in premium list:", error);

    }
}

// Export individual functions
export async function addprem(message, client, list) {

    await modifyprem(message, client, list, "add");
}

export async function delprem(message, client, list) {
    
    await modifyprem(message, client, list, "remove");
}

export default { addprem, delprem };
