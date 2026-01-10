const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(raw || '{}');
    if (!state.perGroup) state.perGroup = {};
    if (typeof state.private !== 'boolean') state.private = false;
    return state;
  } catch (e) {
    return { perGroup: {}, private: false };
  }
}

function saveState(state) {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    // ignore write errors
  }
}

function isEnabledForChat(state, chatId) {
  if (!state || !chatId) return false;
  if (chatId.endsWith('@g.us')) {
    return !!state.perGroup?.[chatId];
  }
  // For private chats, use the global private flag
  return !!state.private;
}

async function handleChatbotMessage(sock, chatId, message, userMessage) {
  try {
    if (!chatId) return;
    if (!message?.message) return;
    if (message.key?.fromMe) return; // don't reply to our own messages

    const state = loadState();
    if (!isEnabledForChat(state, chatId)) return;

    const msg = message.message || {};
    const text = (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      ''
    ).toString().trim();

    if (!text) return;

    // Show typing indicator briefly
    try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}

    // Build the prompt; instruct the AI to respond as Mickey and include opinion/suggestions
    const prompt = `You are Mickey, a helpful and friendly assistant. When replying, answer in a clear, helpful way and include your own opinion and a short suggestion at the end to ensure the solution works perfectly.\n\nUser: ${text}`;

    // Try GET with query parameter first (many providers accept this), then fallback to POST
    let apiResult = null;
    const encoded = encodeURIComponent(prompt);
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/gemini?q=${encoded}`;

    try {
      const res = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      apiResult = data?.message || data?.data || data?.answer || data?.result || (typeof data === 'string' ? data : null);
    } catch (e) {
      apiResult = null;
    }

    if (!apiResult) {
      // fallback to POST
      try {
        const res = await fetch('https://okatsu-rolezapiiz.vercel.app/ai/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        apiResult = data?.message || data?.data || data?.answer || data?.result || (typeof data === 'string' ? data : null);
      } catch (e) {
        apiResult = null;
      }
    }

    if (!apiResult) {
      await sock.sendMessage(chatId, { text: '❌ Chatbot: failed to get a response. Please try again later.' }, { quoted: message });
      return;
    }

    // Send the reply
    await sock.sendMessage(chatId, { text: apiResult }, { quoted: message });
  } catch (e) {
    console.error('handleChatbotMessage error:', e?.message || e);
  }
}

async function groupChatbotToggleCommand(sock, chatId, message, args) {
  try {
    const argStr = (args || '').trim().toLowerCase();

    // Private toggle (owner only)
    if (argStr.startsWith('private')) {
      const parts = argStr.split(/\s+/);
      const sub = parts[1];
      if (!sub || !['on', 'off', 'status'].includes(sub)) {
        return sock.sendMessage(chatId, { text: 'Usage: .chatbot private on|off|status (Owner only)' }, { quoted: message });
      }

      const sender = message.key.participant || message.key.remoteJid;
      const isOwner = message.key.fromMe || await require('../lib/isOwner')(sender, sock, chatId);
      if (!isOwner) return sock.sendMessage(chatId, { text: 'Only Owner or Sudo can toggle private chatbot.' }, { quoted: message });

      const state = loadState();
      if (sub === 'status') {
        return sock.sendMessage(chatId, { text: `Private chatbot is currently *${state.private ? 'ON' : 'OFF'}*.` }, { quoted: message });
      }

      state.private = sub === 'on';
      saveState(state);
      return sock.sendMessage(chatId, { text: `Private chatbot is now *${state.private ? 'ON' : 'OFF'}*.` }, { quoted: message });
    }

    // Group toggle
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'Usage: .chatbot on|off|status (group admins) OR .chatbot private on|off|status (owner only)' }, { quoted: message });
    }

    const sender = message.key.participant || message.key.remoteJid;
    const adminInfo = await isAdmin(sock, chatId, sender);
    if (!adminInfo.isSenderAdmin && !message.key.fromMe) return sock.sendMessage(chatId, { text: 'Only group admins can toggle chatbot.' }, { quoted: message });

    const onoff = argStr;
    if (!onoff || !['on', 'off', 'status'].includes(onoff)) {
      return sock.sendMessage(chatId, { text: 'Usage: .chatbot on|off|status' }, { quoted: message });
    }

    const state = loadState();
    state.perGroup = state.perGroup || {};

    if (onoff === 'status') {
      const enabled = !!state.perGroup[chatId];
      return sock.sendMessage(chatId, { text: `Chatbot is currently *${enabled ? 'ON' : 'OFF'}* for this group.` }, { quoted: message });
    }

    state.perGroup[chatId] = onoff === 'on';
    saveState(state);
    try {
      const libIndex = require('../lib/index');
      if (state.perGroup[chatId]) await libIndex.setChatbot(chatId, true);
      else await libIndex.removeChatbot(chatId);
    } catch (e) {}
    return sock.sendMessage(chatId, { text: `Chatbot is now ${state.perGroup[chatId] ? 'ON' : 'OFF'} for this group.` }, { quoted: message });
  } catch (e) {
    console.error('groupChatbotToggleCommand error:', e);
    return sock.sendMessage(chatId, { text: 'Failed to toggle chatbot.' }, { quoted: message });
  }
}

module.exports = { handleChatbotMessage, groupChatbotToggleCommand };
