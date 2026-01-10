const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { perGroup: {}, private: false };
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
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save chatbot state:', e);
  }
}

async function isEnabledForChat(state, chatId) {
  if (!state || !chatId) return false;
  if (chatId.endsWith('@g.us')) {
    // prefer the perGroup in this file, but fall back to global userGroupData if present
    if (state.perGroup?.[chatId]) return true;
    try {
      const lib = require('../lib/index');
      const cfg = await lib.getChatbot(chatId);
      return !!(cfg && cfg.enabled);
    } catch (e) {
      return false;
    }
  }
  return !!state.private;
}

function extractMessageText(message) {
  if (!message?.message) return '';

  const msg = message.message;

  // Plain text
  if (msg.conversation) return msg.conversation.trim();
  
  // Reply/quoted/extended text
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text.trim();
  
  // Media captions
  if (msg.imageMessage?.caption) return msg.imageMessage.caption.trim();
  if (msg.videoMessage?.caption) return msg.videoMessage.caption.trim();
  if (msg.documentMessage?.caption) return msg.documentMessage.caption.trim();

  // Buttons & interactive
  if (msg.buttonsMessage?.text || msg.buttonsMessage?.headerText) {
    return (msg.buttonsMessage.text || msg.buttonsMessage.headerText).trim();
  }
  if (msg.templateMessage?.hydratedTemplate?.hydratedContentText) {
    return msg.templateMessage.hydratedTemplate.hydratedContentText.trim();
  }
  if (msg.interactiveMessage?.body?.text) return msg.interactiveMessage.body.text.trim();

  // List fallback
  if (msg.listMessage?.description) return msg.listMessage.description.trim();

  return '';
}

async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId) return;
    if (message.key?.fromMe) return; // don't reply to self

    const state = loadState();
    if (!(await isEnabledForChat(state, chatId))) return;

    const userText = extractMessageText(message);
    if (!userText) return; // no text → skip

    console.log(`[Chatbot] Processing in ${chatId}: "${userText.substring(0, 70)}${userText.length > 70 ? '...' : ''}"`);

    // Show typing indicator + small natural delay
    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    } catch (e) {}

    // Original prompt style + instruction to reply naturally
    const prompt = `You are Mickey, a helpful and friendly assistant. When replying, answer in a clear, helpful way and include your own opinion and a short suggestion at the end to ensure the solution works perfectly.\n\nUser: ${userText}`;

    const encoded = encodeURIComponent(prompt);
    const baseUrl = 'https://okatsu-rolezapiiz.vercel.app/ai/gemini';

    let apiResult = null;

    // Try GET first (original style)
    try {
      const getUrl = `${baseUrl}?q=${encoded}`;
      const res = await fetch(getUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const data = await res.json();
        apiResult = data?.message || data?.data || data?.answer || data?.result || 
                    data?.response || (typeof data === 'string' ? data : null);
      }
    } catch (e) {
      console.log('GET failed:', e.message);
    }

    // Fallback to POST (try both `prompt` and `text`, and log keys returned)
    if (!apiResult) {
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ prompt, text: prompt })
        });

        if (res.ok) {
          const data = await res.json();
          console.log('[Chatbot] POST API returned keys:', data && typeof data === 'object' ? Object.keys(data) : typeof data);
          apiResult = data?.message || data?.data || data?.answer || data?.result || 
                      data?.response || (typeof data === 'string' ? data : null);
        }
      } catch (e) {
        console.log('POST failed:', e.message);
      }
    }

    // Additional public API fallbacks used elsewhere in this project
    if (!apiResult) {
      const apis = [
        `${baseUrl}?q=${encodeURIComponent(userText)}`,
        `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(userText)}`,
        `https://okatsu-rolezapiiz.vercel.app/ai/chat?q=${encodeURIComponent(userText)}`
      ];
      for (const api of apis) {
        try {
          const res = await fetch(api, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
          if (!res.ok) { console.log('[Chatbot] Fallback API not ok:', api, res.status); continue; }
          const data = await res.json();
          apiResult = data?.message || data?.data || data?.answer || data?.result || data?.response || (typeof data === 'string' ? data : null);
          if (apiResult) {
            console.log('[Chatbot] Fallback API succeeded:', api);
            break;
          }
        } catch (e) {
          console.log('[Chatbot] Fallback api failed:', api, e.message);
          continue;
        }
      }
    }

    if (!apiResult) {
      await sock.sendMessage(chatId, { 
        text: '❌ Sorry, failed to get response from AI. Try again later!' 
      }, { quoted: message });
      return;
    }

    // Send response INTACT (only trim whitespace)
    const cleanResponse = (apiResult || '').toString().trim();

    console.log(`[Chatbot] Replying to ${chatId} (${cleanResponse.length} chars)`);
    await sock.sendMessage(chatId, { text: cleanResponse }, { quoted: message });

  } catch (err) {
    console.error('Chatbot error:', err?.message || err);
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
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'This command works in groups or use .chatbot private ...' }, { quoted: message });
    }

    const sender = message.key.participant || message.key.remoteJid;
    const adminInfo = await isAdmin(sock, chatId, sender);
    if (!adminInfo.isSenderAdmin && !message.key.fromMe) {
      return sock.sendMessage(chatId, { text: 'Only group admins can toggle chatbot.' }, { quoted: message });
    }

    const onoff = argStr;
    if (!onoff || !['on', 'off', 'status'].includes(onoff)) {
      return sock.sendMessage(chatId, { text: 'Usage: .chatbot on|off|status' }, { quoted: message });
    }

    const state = loadState();
    state.perGroup = state.perGroup || {};

    if (onoff === 'status') {
      const lib = require('../lib/index');
      const cfg = await lib.getChatbot(chatId);
      const enabled = !!state.perGroup[chatId] || !!(cfg && cfg.enabled);
      return sock.sendMessage(chatId, { text: `Chatbot is currently *${enabled ? 'ON' : 'OFF'}* for this group.` }, { quoted: message });
    }

    const lib = require('../lib/index');
    state.perGroup[chatId] = onoff === 'on';
    saveState(state);
    try {
      if (state.perGroup[chatId]) await lib.setChatbot(chatId, true);
      else await lib.removeChatbot(chatId);
    } catch (e) {
      console.log('Sync userGroupData chatbot failed:', e?.message || e);
    }

    return sock.sendMessage(chatId, { 
      text: `Chatbot is now ${state.perGroup[chatId] ? 'ON' : 'OFF'} for this group!` 
    }, { quoted: message });

  } catch (e) {
    console.error('Toggle error:', e);
    sock.sendMessage(chatId, { text: 'Failed to toggle chatbot.' }, { quoted: message });
  }
}

module.exports = { handleChatbotMessage, groupChatbotToggleCommand };