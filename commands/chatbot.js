const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

// ← Add your API key here
const API_KEY = "your_api_key_here";  // ← Replace with real key!

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

async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId) return;
    if (message.key?.fromMe) return;

    const state = loadState();
    if (!(await isEnabledForChat(state, chatId))) return;

    const userText = extractMessageText(message);
    if (!userText) return;

    console.log(`[Chatbot] Processing in \( {chatId}: " \){userText.substring(0, 70)}${userText.length > 70 ? '...' : ''}"`);

    // typing indicator
    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    } catch {}

    // New API format
    const query = `You are Mickey, a helpful and friendly assistant. When replying, answer in a clear, helpful way and include your own opinion and a short suggestion at the end to ensure the solution works perfectly.\n\nUser: ${userText}`;

    const encodedQuery = encodeURIComponent(query);
    const apiUrl = `https://apis.davidcyriltech.my.id/ai/chatbot?query=\( {encodedQuery}&apikey= \){API_KEY}`;

    let apiResult = null;

    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000)
      });

      if (!res.ok) {
        throw new Error(`API responded with status ${res.status}`);
      }

      const data = await res.json();

      // Try to find the response in common keys
      apiResult = data?.response 
        || data?.message 
        || data?.result 
        || data?.answer 
        || data?.data 
        || data?.text
        || (typeof data === 'string' ? data : null)
        || data?.content;

      if (!apiResult && data?.error) {
        console.log('[Chatbot] API error:', data.error);
      }

    } catch (err) {
      console.error('[Chatbot] API call failed:', err.message);
    }

    // Fallback message if API fails completely
    if (!apiResult) {
      await sock.sendMessage(chatId, { 
        text: '❌ Sorry, AI is not responding right now. Please try again in a minute!' 
      }, { quoted: message });
      return;
    }

    const cleanResponse = (apiResult || '').toString().trim();

    console.log(`[Chatbot] Replying (${cleanResponse.length} chars)`);

    await sock.sendMessage(chatId, { text: cleanResponse }, { quoted: message });

  } catch (err) {
    console.error('Chatbot error:', err?.message || err);
  }
}

// The toggle command part remains unchanged
// ... (groupChatbotToggleCommand stays the same)

module.exports = { handleChatbotMessage, groupChatbotToggleCommand };