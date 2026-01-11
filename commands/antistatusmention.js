const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

function loadState() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'antistatusmention.json'), 'utf8');
    const state = JSON.parse(raw);
    if (!state.perGroup) state.perGroup = {};
    return state;
  } catch (e) {
    return { perGroup: {} };
  }
}

function saveState(state) {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'antistatusmention.json'), JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save antistatusmention state:', e?.message || e);
  }
}

function isEnabledForChat(state, chatId) {
  if (!state) return false;
  if (typeof state.perGroup?.[chatId] === 'boolean') return !!state.perGroup[chatId];
  return false;
}

async function handleAntiStatusMention(sock, chatId, message) {
  try {
    // Only operate in groups on incoming messages
    if (!chatId || !chatId.endsWith('@g.us')) return;
    if (!message?.message) return;
    if (message.key?.fromMe) return; // ignore our own messages

    const state = loadState();
    if (!isEnabledForChat(state, chatId)) return;

    // Normalize bot JID and prepare mention heuristics
    const rawBotId = sock.user?.id || sock.user?.jid || '';
    const botNum = rawBotId.split('@')[0].split(':')[0];

    // Extract text content from many possible message shapes
    const msg = message.message || {};
    const text = (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
      ''
    ).toString();
    if (!text) return;

    // If the message explicitly mentions users, ignore (we only target status-mention spam)
    const mentionedJids = [];
    const ctxs = [
      msg.extendedTextMessage?.contextInfo,
      msg.imageMessage?.contextInfo,
      msg.videoMessage?.contextInfo,
      msg.listResponseMessage?.contextInfo,
      msg.buttonsResponseMessage?.contextInfo
    ].filter(Boolean);
    for (const c of ctxs) {
      if (Array.isArray(c?.mentionedJid)) mentionedJids.push(...c.mentionedJid);
    }
    if (Array.isArray(msg?.mentionedJid)) mentionedJids.push(...msg.mentionedJid);

    if (mentionedJids.length > 0) return; // actual mentions are not status mention spam

    // Heuristic: many status-mention spam messages use phrases like "mentioned this group" or "status mention"
    const phraseRegex = /\b(mention(?:ed)?\s+(?:this\s+)?group|mentioned\s+(?:this\s+)?group|status\s+mention(?:ed)?|mentioned\s+in\s+status|mention\s+status)\b/i;
    if (!phraseRegex.test(text)) {
      // Fallback heuristic: message contains bot number like @123456 - often used in status mention captions
      const stripped = text.replace(/\s+/g, '');
      if (!new RegExp(`@?${botNum}\b`).test(stripped)) return;
    }

    // Don't delete messages from group admins (safer) or from the bot itself
    const sender = message.key.participant || message.key.remoteJid;
    const senderAdminInfo = await isAdmin(sock, chatId, sender).catch(() => ({ isSenderAdmin: false }));
    if (senderAdminInfo.isSenderAdmin) return;

    // Ensure bot is admin so we can delete
    const botAdminInfo = await isAdmin(sock, chatId, rawBotId).catch(() => ({ isBotAdmin: false }));
    if (!botAdminInfo.isBotAdmin) return;

    // Attempt to delete the offending message (best-effort)
    try {
      const messageId = message.key.id;
      const participant = message.key.participant || message.key.remoteJid;

      console.log('AntiStatusMention: matched phrase, attempting delete', { chatId, msgId: messageId, participant });

      // Try to delete using the existing key (preferred)
      let deleted = false;
      try {
        if (message.key) {
          await sock.sendMessage(chatId, { delete: message.key });
          deleted = true;
          console.log('Message deleted successfully using message.key method');
        }
      } catch (err1) {
        // Structured fallback
        try {
          const deleteKey = { remoteJid: chatId, fromMe: false, id: messageId, participant };
          await sock.sendMessage(chatId, { delete: deleteKey });
          deleted = true;
          console.log('Message deleted successfully using structured deleteKey');
        } catch (err2) {
          try {
            await sock.sendMessage(chatId, { delete: { remoteJid: chatId, id: messageId } });
            deleted = true;
            console.log('Message deleted successfully using ID-only fallback');
          } catch (err3) {
            console.error('All delete methods failed:', err1?.message || err1, err2?.message || err2, err3?.message || err3);
          }
        }
      }

      // Optionally notify group (avoid tagging the sender)
      try {
        const senderName = sender ? `@${sender.split('@')[0]}` : 'User';
        const status = deleted ? '✅ Message deleted' : '⚠️ Attempted to delete but failed';
        await sock.sendMessage(chatId, { text: `ℹ️ *Anti-Status-Mention*

• Sender: ${senderName}
• Action: ${status}

If the message persists, ensure the bot has admin rights and the message is still removable.` });
      } catch (e) {
        console.error('Failed to send info message:', e?.message || e);
      }
    } catch (e) {
      console.error('Failed to handle status mention message:', e?.message || e);
    }
  } catch (err) {
    console.error('handleAntiStatusMention error:', err?.message || err);
  }
}

async function groupAntiStatusToggleCommand(sock, chatId, message, args) {
  try {
    if (!chatId || !chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: 'This command only works in groups.' }, { quoted: message });

    const sender = message.key.participant || message.key.remoteJid;
    const adminInfo = await isAdmin(sock, chatId, sender);
    if (!adminInfo.isSenderAdmin && !message.key.fromMe) return sock.sendMessage(chatId, { text: 'Only group admins can toggle anti-status-mention.' }, { quoted: message });

    const onoff = (args || '').trim().toLowerCase();
    if (!onoff || !['on', 'off'].includes(onoff)) {
      return sock.sendMessage(chatId, { text: 'Usage: .antistatusmention on|off' }, { quoted: message });
    }

    const state = loadState();
    state.perGroup = state.perGroup || {};
    state.perGroup[chatId] = onoff === 'on';
    saveState(state);
    return sock.sendMessage(chatId, { text: `Anti-status-mention is now ${state.perGroup[chatId] ? 'ON' : 'OFF'} for this group.` }, { quoted: message });
  } catch (e) {
    console.error('groupAntiStatusToggleCommand error:', e);
    return sock.sendMessage(chatId, { text: 'Failed to toggle anti-status-mention.' }, { quoted: message });
  }
}

module.exports = { handleAntiStatusMention, groupAntiStatusToggleCommand };
