const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const axios = require('axios');
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
    if (state.perGroup?.[chatId]?.enabled !== undefined) {
      return !!state.perGroup[chatId].enabled;
    }
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

  if (msg.conversation) return msg.conversation.trim();
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text.trim();
  if (msg.imageMessage?.caption) return msg.imageMessage.caption.trim();
  if (msg.videoMessage?.caption) return msg.videoMessage.caption.trim();
  if (msg.documentMessage?.caption) return msg.documentMessage.caption.trim();

  if (msg.buttonsMessage?.text || msg.buttonsMessage?.headerText) {
    return (msg.buttonsMessage.text || msg.buttonsMessage.headerText).trim();
  }
  if (msg.templateMessage?.hydratedTemplate?.hydratedContentText) {
    return msg.templateMessage.hydratedTemplate.hydratedContentText.trim();
  }
  if (msg.interactiveMessage?.body?.text) return msg.interactiveMessage.body.text.trim();

  if (msg.listMessage?.description) return msg.listMessage.description.trim();

  return '';
}

// ────────────────────────────────────────────────
//          VOICE SETTINGS - customize here
// ────────────────────────────────────────────────
const DEFAULT_VOICE_MODEL = "ana";           // Change to: nahida, nami, taylor_swift, goku, etc.
// const MIN_TEXT_FOR_VOICE = 8;
// const MAX_TEXT_FOR_VOICE = 1200;

async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId) return;
    if (message.key?.fromMe) return;

    const state = loadState();
    if (!(await isEnabledForChat(state, chatId))) return;

    const userText = extractMessageText(message);
    if (!userText) return;

    console.log(`[Chatbot] \( {chatId} → " \){userText.substring(0, 70)}${userText.length > 70 ? '...' : ''}"`);

    // Show typing
    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    } catch {}

    // ──── Get AI response ────
    const encoded = encodeURIComponent(userText);
    const apiUrl = `https://api.yupra.my.id/api/ai/gpt5?text=${encoded}`;

    let apiResult = null;

    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      apiResult =
        data?.response ||
        data?.message ||
        data?.result ||
        data?.answer ||
        data?.text ||
        data?.content ||
        data?.output ||
        (typeof data === 'string' ? data : null);

    } catch (err) {
      console.error('[AI API failed]', err.message);
    }

    if (!apiResult) {
      await sock.sendMessage(chatId, { 
        text: '❌ Sorry, AI is having issues right now. Try again later.' 
      }, { quoted: message });
      return;
    }

    const replyText = String(apiResult).trim();

    // ──── 1. Always send the TEXT message first ────
    const textMsg = await sock.sendMessage(chatId, { 
      text: replyText 
    }, { quoted: message });

    // ──── 2. Then try to send VOICE NOTE ────
    try {
      // Optional length filter - adjust as you like
      if (replyText.length < 10 || replyText.length > 1100) {
        console.log("[Voice] Skipped - text too short/long");
        return;
      }

      const voiceApiUrl = `https://api.agatz.xyz/api/voiceover?text=\( {encodeURIComponent(replyText)}&model= \){DEFAULT_VOICE_MODEL}`;

      const response = await axios.get(voiceApiUrl, {
        timeout: 35000
      });

      if (response.data?.status === 200 && response.data?.data?.oss_url) {
        const audioUrl = response.data.data.oss_url;

        await sock.sendMessage(chatId, {
          audio: { url: audioUrl },
          mimetype: 'audio/mpeg',
          ptt: true,                    // voice note (ptt = push-to-talk style)
          fileName: 'AI Voice Reply.mp3',
          // Optional: seconds, waveform, etc. (Baileys can auto-detect duration)
        }, { quoted: textMsg });       // quote the text message → voice appears as reply to text

        console.log(`[Voice] Sent voice note (${replyText.length} chars) using ${DEFAULT_VOICE_MODEL}`);
      } else {
        console.log("[Voice] API returned non-200 or no url");
      }
    } catch (voiceErr) {
      console.error("[Voice generation failed]", voiceErr.message || voiceErr);
      // No fallback needed - text was already sent
    }

  } catch (err) {
    console.error('Chatbot general error:', err);
    try {
      await sock.sendMessage(chatId, { 
        text: '⚠️ Something went wrong. Please try again.' 
      }, { quoted: message });
    } catch {}
  }
}

async function groupChatbotToggleCommand(sock, chatId, message, args) {
  try {
    const argStr = (args || '').trim().toLowerCase();

    if (argStr.startsWith('private')) {
      const parts = argStr.split(/\s+/);
      const sub = parts[1];
      if (!sub || !['on', 'off', 'status'].includes(sub)) {
        return sock.sendMessage(chatId, { text: 'Usage: .chatbot private on|off|status' }, { quoted: message });
      }

      const sender = message.key.participant || message.key.remoteJid;
      const isOwner = message.key.fromMe || await require('../lib/isOwner')(sender, sock, chatId);
      if (!isOwner) return sock.sendMessage(chatId, { text: 'Owner only.' }, { quoted: message });

      const state = loadState();
      if (sub === 'status') {
        return sock.sendMessage(chatId, { text: `Private mode: *${state.private ? 'ON' : 'OFF'}*` }, { quoted: message });
      }

      state.private = sub === 'on';
      saveState(state);
      return sock.sendMessage(chatId, { text: `Private mode: *${state.private ? 'ON' : 'OFF'}*` }, { quoted: message });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'Use in groups or .chatbot private ...' }, { quoted: message });
    }

    const sender = message.key.participant || message.key.remoteJid;
    const adminInfo = await isAdmin(sock, chatId, sender);
    if (!adminInfo.isSenderAdmin && !message.key.fromMe) {
      return sock.sendMessage(chatId, { text: 'Admins only' }, { quoted: message });
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
      const enabled = state.perGroup[chatId]?.enabled ?? !!(cfg && cfg.enabled);
      return sock.sendMessage(chatId, { text: `Chatbot: *${enabled ? 'ON' : 'OFF'}*` }, { quoted: message });
    }

    const lib = require('../lib/index');
    state.perGroup[chatId] = state.perGroup[chatId] || {};
    state.perGroup[chatId].enabled = onoff === 'on';
    saveState(state);

    try {
      if (state.perGroup[chatId].enabled) await lib.setChatbot(chatId, true);
      else await lib.removeChatbot(chatId);
    } catch (e) {
      console.log('Lib sync failed:', e?.message);
    }

    return sock.sendMessage(chatId, { 
      text: `Chatbot is now *${state.perGroup[chatId].enabled ? 'ON' : 'OFF'}*` 
    }, { quoted: message });

  } catch (e) {
    console.error('Toggle command error:', e);
    sock.sendMessage(chatId, { text: 'Command failed.' }, { quoted: message });
  }
}

module.exports = {
  handleChatbotMessage,
  groupChatbotToggleCommand
};