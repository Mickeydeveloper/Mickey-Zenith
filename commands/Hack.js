
import pkg from 'baileys';

const { getDevice } = pkg;

// Prank hack steps array for progressive simulation
const hackSteps = [
    "Initiating connection to target device...",
    "Scanning for vulnerabilities...",
    "Bypassing firewall: 25% complete...",
    "Bypassing firewall: 50% complete...",
    "Bypassing firewall: 75% complete...",
    "Firewall bypassed! Accessing data...",
    "Downloading files: 30%...",
    "Downloading files: 60%...",
    "Downloading files: 90%...",
    "Download complete! Extracting sensitive info...",
    "Hack successful! Just kidding, this is a prank! 😂 No harm done."
];

export async function prankHack(message, client) {
    const remoteJid = message.key.remoteJid;
    let step = 0; // Track the current step in the prank sequence

    try {
        // Get the device for added realism in the prank
        const quotedMessageId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
        let device = 'unknown';
        if (quotedMessageId) {
            device = getDevice(quotedMessageId);
        }

        // Start the prank by sending the first message
        await client.sendMessage(remoteJid, { text: `_Prank hack initiated on ${device} device..._` });

        // Function to send progressive steps with delays
        const sendNextStep = async () => {
            if (step < hackSteps.length) {
                await client.sendMessage(remoteJid, { text: `_${hackSteps[step]}_` });
                step++;
                // Delay between steps to simulate progress (e.g., 2 seconds)
                setTimeout(sendNextStep, 2000);
            }
        };

        // Kick off the progressive steps
        sendNextStep();

    } catch (error) {
        await client.sendMessage(remoteJid, { text: `_Error: Prank hack failed. ${error.message}_` });
    }
}

export default Hack;
