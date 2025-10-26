import axios from 'axios'; // Optional — included for consistency with other formulas

export async function love(message, client) {
  const remoteJid = message.key.remoteJid;

  const messageBody = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  ).trim();

  try {
    // 📝 Extract text after command (if any)
    const text = getArg(messageBody);

    // Default message if no input
    const defaultText = "I LOVE YOU! 💖";
    const messageToSend = text || defaultText;

    // ❤️ Array of heart emojis for animation
    const heartEmojis = [
      "❤", "💕", "😻", "🧡", "💛", "💚", "💙", "💜", "🖤", "❣",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥", "💌",
      "🙂", "🤗", "😌", "😉", "🤗", "😊", "🎊", "🎉", "🎁", "❤"
    ];

    console.log(`💬 Sending love message: ${messageToSend}`);

    // 💌 Send the first message
    const sent = await client.sendMessage(remoteJid, {
      text: `${messageToSend} 💖`,
    }, { quoted: message });

    // 💞 Animate hearts by editing the same message repeatedly
    for (let i = 0; i < heartEmojis.length; i++) {
      const newText = `${heartEmojis[i]}`;

      await client.relayMessage(
        remoteJid,
        {
          protocolMessage: {
            key: sent.key,
            type: 14,
            editedMessage: { conversation: newText },
          },
        },
        {}
      );

      await sleep(800); // delay between edits
    }

    console.log('✅ Love animation complete.');

  } catch (err) {
    console.error('❌ Error in love command:', err);
    await client.sendMessage(remoteJid, {
      text: `❌ Failed to send love animation: ${err.message}`,
    });
  }
}

// Extract text argument after command
function getArg(body) {
  const parts = body.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default love;
