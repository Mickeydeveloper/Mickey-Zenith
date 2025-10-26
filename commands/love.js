// Simple love animation command compatible with the project's client API.
// This implementation sends a starter message (with optional text) and
// then sends a sequence of heart emojis. It avoids low-level relay/edit
// operations which are not required here and can be incompatible.

export async function love(message, client) {
  const remoteJid = message.key?.remoteJid;

  const messageBody = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  );

  try {
    // Parse args similar to other commands (strip the leading prefix/command)
    const commandAndArgs = messageBody.slice(1).trim();
    const parts = commandAndArgs.split(/\s+/);
    const text = parts.slice(1).join(' ').trim();

    const defaultText = 'I LOVE YOU! 💖';
    const messageToSend = text || defaultText;

    const heartEmojis = [
      '❤', '💕', '😻', '🧡', '💛', '💚', '💙', '💜', '🖤', '❣',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥', '💌',
      '🙂', '🤗', '😌', '😉', '🤗', '😊', '🎊', '🎉', '🎁', '❤'
    ];

    // Send the starter message (quoted to the original command)
    await client.sendMessage(remoteJid, { text: `${messageToSend} 💖` }, { quoted: message });

    // Send heart animation messages sequentially
    for (let i = 0; i < heartEmojis.length; i++) {
      await sleep(700);
      await client.sendMessage(remoteJid, { text: heartEmojis[i] });
    }

  } catch (err) {
    console.error('Error in love command:', err);
    if (remoteJid) {
      await client.sendMessage(remoteJid, { text: `❌ Failed to send love animation: ${err.message}` });
    }
  }
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default love;
