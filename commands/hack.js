// Harmless progressive prank that sends a sequence of messages to simulate a "hack".
// Exported as default `hack` to match how commands are imported in the project.

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

async function hack(message, client) {
    const remoteJid = message.key.remoteJid;
    let step = 0; // Track the current step in the prank sequence

    try {
        // Determine a friendly device label if possible. Keep it harmless.
        let device = 'android';
        const quoted = message.message?.extendedTextMessage?.contextInfo;
        if (quoted?.participant) device = quoted.participant.split('@')[0];

        // Start the prank by sending the first message
        await client.sendMessage(remoteJid, { text: `_Prank hack initiated on ${device} device..._` });

        // Function to send progressive steps with delays
        const sendNextStep = async () => {
            if (step < hackSteps.length) {
                try {
                    await client.sendMessage(remoteJid, { text: `_${hackSteps[step]}_` });
                } catch (e) {
                    // ignore per-step send errors to continue the sequence
                }
                step++;
                // Delay between steps to simulate progress (e.g., 2 seconds)
                setTimeout(sendNextStep, 2000);
            }
        };

        // Kick off the progressive steps
        sendNextStep();

    } catch (error) {
        try {
            await client.sendMessage(remoteJid, { text: `_Error: Prank hack failed. ${error.message}_` });
        } catch (e) {
            // best-effort only
        }
    }
}

export default hack;
// Exported as default `hack` to match how commands are imported in the project.
