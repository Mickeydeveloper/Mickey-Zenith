export async function love(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    // Extract text from user
    const msgBody =
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation ||
        "";

    try {
        const clean = msgBody.slice(1).trim().split(/\s+/);
        const text = clean.slice(1).join(" ").trim();

        const defaultText = "I LOVE YOU! 💖";
        const displayText = text || defaultText;

        const frames = [
            "❤", "💕", "😻", "🧡", "💛", "💚", "💙", "💜", "🖤", "❣",
            "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥", "💌",
            "🙂", "🤗", "😌", "😉", "🤗", "😊", "🎊", "🎉", "🎁", "❤"
        ];

        // 1) Send initial message ONCE
        const sent = await client.sendMessage(
            remoteJid,
            { text: `${displayText} 💖` },
            { quoted: message }
        );

        const msgId = sent.key.id;

        // 2) Edit SAME message repeatedly
        for (let i = 0; i < frames.length; i++) {
            await sleep(500);

            await client.sendMessage(remoteJid, {
                text: `${displayText} ${frames[i]}`,
                edit: {
                    remoteJid: remoteJid,
                    id: msgId,
                    fromMe: true
                }
            });
        }

    } catch (err) {
        console.error("LOVE CMD ERROR:", err);
        await client.sendMessage(remoteJid, {
            text: `❌ Love animation failed: ${err.message}`
        });
    }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export default love;
