export async function getpp(message, client) {
  const remoteJid = message.key.remoteJid;
  const quoted = message.message?.extendedTextMessage?.contextInfo;
  let targetJid;

  // 1) If they mentioned someone: use the first mentioned JID
  const mentions = quoted?.mentionedJid;
  if (mentions && mentions.length) {
    targetJid = mentions[0];
  }

  // 2) Else if they replied to someone: use the participant of the quoted message
  else if (quoted?.participant) {
    targetJid = quoted.participant;
  }

  // 3) Else if they passed a number in the text: parse it
  else {
    const args =
      (message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        "")
        .trim()
        .split(/\s+/);

    if (args[1]) {
      // clean number (remove +, spaces, dashes)
      let num = args[1].replace(/[^0-9]/g, "");
      if (num.length < 7) {
        await client.sendMessage(remoteJid, {
          text: "> ⚠️ Invalid number format",
        });
        return;
      }
      targetJid = `${num}@s.whatsapp.net`;
    }
  }

  // 4) Fallback: use the sender themselves
  if (!targetJid) {
    targetJid = message.key.fromMe
      ? client.user.id // your own JID
      : message.key.participant || message.key.remoteJid;
  }

  try {
    // Fetch profile pic (may throw if none set)
    const url = await client.profilePictureUrl(targetJid, "image");

    await client.sendMessage(
      remoteJid,
      {
        image: { url },
        caption: `📸 Profile picture of *@${targetJid.split("@")[0]}*`,
      },
      { quoted: message }
    );
  } catch (err) {
    console.error("❌ Error fetching profile picture:", err);
    await client.sendMessage(
      remoteJid,
      {
        text: `❌ Could not fetch profile picture for *@${targetJid.split("@")[0]}*.`,
      },
      { quoted: message }
    );
  }
}

export default getpp;
