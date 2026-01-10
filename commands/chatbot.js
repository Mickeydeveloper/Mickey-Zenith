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

function isEnabledForChat(state, chatId) {
  if (!state || !chatId) return false;
  if (chatId.endsWith('@g.us')) {
    return !!state.perGroup?.[chatId];
  }
  return !!state.private;
}

function extractMessageText(message) {
  if (!message?.message) return '';

  const msg = message.message;

  // Most common cases first
  if (msg.conversation) return msg.conversation.trim();
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text.trim();
  
  // Media with captions
  if (msg.imageMessage?.caption) return msg.imageMessage.caption.trim();
  if (msg.videoMessage?.caption) return msg.videoMessage.caption.trim();
  if (msg.documentMessage?.caption) return msg.documentMessage.caption.trim();
  if (msg.stickerMessage?.caption) return msg.stickerMessage.caption.trim(); // rare

  // Interactive / buttons / templates
  if (msg.buttonsMessage?.text) return msg.buttonsMessage.text.trim();
  if (msg.buttonsMessage?.headerText) return msg.buttonsMessage.headerText.trim();
  if (msg.templateMessage?.hydratedTemplate?.hydratedContentText) {
    return msg.templateMessage.hydratedTemplate.hydratedContentText.trim();
  }
  if (msg.interactiveMessage?.body?.text) return msg.interactiveMessage.body.text.trim();
  if (msg.listMessage?.description) return msg.listMessage.description.trim();
  if (msg.listMessage?.title) return msg.listMessage.title.trim(); // fallback

  // Quoted / forwarded / very rare cases
  if (msg.extendedTextMessage?.description) return msg.extendedTextMessage.description.trim();

  return '';
}

async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId) return;
    if (message.key?.fromMe) return; // ignore own messages

    const state = loadState();
    if (!isEnabledForChat(state, chatId)) return;

    const text = extractMessageText(message);
    if (!text || text.length < 1) return; // no text → skip

    // Optional: ignore very short messages or commands
    // if (text.length <= 2 || text.startsWith('.')) return;

    console.log(`[Mickey] \( {chatId} → " \){text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

    // Show typing indicator
    try {
      await sock.sendPresenceUpdate('composing', chatId);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200)); // natural delay
    } catch {}

    const prompt = `You are Mickey, a helpful, friendly and slightly funny assistant from Tanzania. 
Always reply in a natural, warm way. Include your own short opinion and one practical suggestion at the end.
Keep answers clear and not too long.

User: ${text}`;

    const encodedPrompt = encodeURIComponent(prompt);
    let responseText = null;

    // === 2026 WORKING PROXY OPTIONS (pick one - test them) ===
    // Best: deploy your own → https://github.com/DavidKk/Vercel-Gemini-Proxy
    // Public ones (may die any day):
    const proxies = [
      `https://gemini-proxy-psi.vercel.app/api/gemini?q=${encodedPrompt}`,
      `https://free-gemini-api-2025.vercel.app/gemini?q=${encodedPrompt}`,
      `https://gemini-flash-api.vercel.app/api?q=${encodedPrompt}`
    ];

    for (const url of proxies) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(12000) // 12s timeout
        });

        if (!res.ok) continue;

        const data = await res.json();
        responseText = 
          data?.response ||
          data?.message ||
          data?.text ||
          data?.result ||
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          (typeof data === 'string' ? data : null);

        if (responseText) break;
      } catch (e) {
        console.log(`Proxy failed (${url}):`, e.message);
      }
    }

    // POST fallback (some proxies prefer POST)
    if (!responseText) {
      try {
        const res = await fetch('https://gemini-proxy-psi.vercel.app/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'gemini-1.5-flash' })
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data?.response || data?.message || data?.text;
        }
      } catch (e) {
        console.error('POST fallback failed:', e);
      }
    }

    if (!responseText) {
      responseText = 'Pole sana! Mickey ako busy kidogo sasa hivi 😅 Jaribu tena baada ya dakika chache!';
    }

    // Clean response
    responseText = responseText.trim()
      .replace(/^Mickey:\s*/i, '')
      .replace(/\[.*?\]/g, '') // remove random tags some proxies add
      .trim();

    await sock.sendMessage(chatId, { text: responseText }, { quoted: message });

  } catch (err) {
    console.error('Mickey Chatbot Error:', err?.message || err);
  }
}

async function groupChatbotToggleCommand(sock, chatId, message, args) {
  try {
    const argStr = (args || '').trim().toLowerCase();
    const state = loadState();

    // Private mode (owner only)
    if (argStr.startsWith('private')) {
      const parts = argStr.split(/\s+/);
      const sub = parts[1];

      if (!sub || !['on', 'off', 'status'].includes(sub)) {
        return sock.sendMessage(chatId, { 
          text: 'Tumia: .chatbot private on|off|status (Owner tu)' 
        }, { quoted: message });
      }

      const sender = message.key.participant || message.key.remoteJid;
      const isOwner = message.key.fromMe || await require('../lib/isOwner')(sender, sock, chatId);
      if (!isOwner) {
        return sock.sendMessage(chatId, { text: 'Hii ni kwa Owner/Sudo tu!' }, { quoted: message });
      }

      if (sub === 'status') {
        return sock.sendMessage(chatId, { 
          text: `Private mode (DMs) iko **${state.private ? 'ON' : 'OFF'}** sasa.` 
        }, { quoted: message });
      }

      state.private = sub === 'on';
      saveState(state);
      return sock.sendMessage(chatId, { 
        text: `Private mode (DMs) sasa iko **${state.private ? 'ON' : 'OFF'}**!` 
      }, { quoted: message });
    }

    // Group mode
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { 
        text: 'Tumia .chatbot on|off|status (group) au .chatbot private ... (owner)' 
      }, { quoted: message });
    }

    const sender = message.key.participant || message.key.remoteJid;
    const { isSenderAdmin } = await isAdmin(sock, chatId, sender);

    if (!isSenderAdmin && !message.key.fromMe) {
      return sock.sendMessage(chatId, { text: 'Admins wa group tu wanaweza kuwasha/zima!' }, { quoted: message });
    }

    if (!['on', 'off', 'status'].includes(argStr)) {
      return sock.sendMessage(chatId, { 
        text: 'Tumia: .chatbot on | off | status' 
      }, { quoted: message });
    }

    if (argStr === 'status') {
      const enabled = !!state.perGroup[chatId];
      return sock.sendMessage(chatId, { 
        text: `Mickey chatbot iko **${enabled ? 'ON' : 'OFF'}** hapa group.` 
      }, { quoted: message });
    }

    state.perGroup[chatId] = argStr === 'on';
    saveState(state);

    return sock.sendMessage(chatId, { 
      text: `Mickey chatbot sasa iko **${state.perGroup[chatId] ? 'ON' : 'OFF'}** kwa group hii! 🎉` 
    }, { quoted: message });

  } catch (e) {
    console.error('Toggle command error:', e);
    return sock.sendMessage(chatId, { text: 'Hitilafu imetokea wakati wa kubadilisha mode 😓' }, { quoted: message });
  }
}

module.exports = {
  handleChatbotMessage,
  groupChatbotToggleCommand
};