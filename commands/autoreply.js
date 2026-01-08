'use strict';

/**
 * Autoreply Module - Mickey Smart ONLINE Version (Jan 2026)
 * - Now uses external AI API for more natural, intelligent replies
 * - Only sends one simple prompt: "You are Mickey." + user's message
 * - API URL: https://okatsu-rolezapiiz.vercel.app/ai/ask?q=
 * - Detects language automatically and replies in the same language
 * - First message: Warm welcome if new conversation
 * - Follow-ups: Gentle reminders if poking frequently
 * - Special handling: Name queries, greetings
 * - Fully online, dynamic, human-like replies via API
 * - Private chats only, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const RATE_LIMIT_MS = 5000; // 5 seconds between replies to same user

// Store user states
const userStates = new Map(); // userId → { lastTime: timestamp, stage: 'new' | 'waiting' | 'chatting', reminderCount: number }

class ConfigManager {
    constructor(filePath) {
        this.filePath = filePath;
        this._ensure();
        this._data = this._read();
    }

    _ensure() {
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({ enabled: false }, null, 2));
        }
    }

    _read() {
        try {
            return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) || { enabled: false };
        } catch (e) {
            return { enabled: false };
        }
    }

    _write() {
        fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2));
    }

    isEnabled() {
        this._data = this._read();
        return !!this._data.enabled;
    }

    setEnabled(v) {
        this._data.enabled = !!v;
        this._write();
    }

    toggle() {
        this._data.enabled = !this.isEnabled();
        this._write();
        return this._data.enabled;
    }
}

const cfg = new ConfigManager(CONFIG_PATH);

// Simple but effective language detection
function isSwahili(text) {
    const swahiliPattern = /\b(na|wa|ni|kwa|ya|lakini|ndiyo|hapana|asante|karibu|habari|mambo|jambo|poa|sawa|vizuri|nzuri|sana|leo|kesho|jana|bado)\b/i;
    const englishPattern = /\b(the|and|you|me|is|are|was|to|for|with|but|yes|no|thanks|hello|hi|how|what|where|when|good|more)\b/i;
    
    const swCount = (text.match(swahiliPattern) || []).length;
    const enCount = (text.match(englishPattern) || []).length;
    
    return swCount > enCount || swCount > 2;
}

// External AI call - ONLY uses "You are Mickey." + user message
async function askMickeyAI(userMessage, isSwahili) {
    return new Promise((resolve) => {
        try {
            // Single unified prompt: You are Mickey + user message
            const fullPrompt = `You are Mickey, a friendly and cool guy chatting on WhatsApp. Always reply naturally, briefly (1-3 sentences), and in the same language as the user. User's message: "${userMessage}"`;

            const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(fullPrompt)}`;

            const req = https.get(url, { timeout: 9000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        let reply = '';
                        if (res.headers['content-type']?.includes('application/json')) {
                            const json = JSON.parse(data || '{}');
                            reply = json.answer || json.response || json.result || json.text || json.reply || json.output || data;
                        } else {
                            reply = data;
                        }
                        resolve(reply.trim() || null);
                    } catch (e) {
                        resolve(data.trim() || null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        } catch (err) {
            resolve(null);
        }
    });
}

// Fallback replies (in case API fails)
const FALLBACKS = {
    welcome: (sw) => sw 
        ? 'Karibu sana! 🎉 Mickey amepokea ujumbe wako na atajibu hivi karibuni 😊'
        : 'Welcome! 🎉 Mickey got your message and will reply soon 😊',

    reminder: (sw, count) => {
        const msgs = sw ? [
            'Mickey ameona ujumbe wako... Ata-reply soon 😉',
            'Subiri kidogo, Mickey anakuandalia jibu zuri 🌟',
            'Asante kwa subira! Mickey atajibu wakati anapata nafasi 🙏'
        ] : [
            'Mickey saw your message... He\'ll reply soon 😉',
            'Hang on a bit, Mickey\'s preparing a good reply 🌟',
            'Thanks for your patience! Mickey will reply when he can 🙏'
        ];
        return msgs[Math.min(count || 0, msgs.length - 1)];
    },

    name: (sw) => sw ? 'Mimi ni Mickey, rafiki yako hapa! 😄 Unaendeleaje?' : 'I\'m Mickey, your friend here! 😄 How you doing?'
};

function isGreeting(text) {
    const lower = text.toLowerCase();
    return /\b(hi|hello|hey|habari|jambo|mambo|salama|poa|vipi|sup|hiya)\b/.test(lower);
}

function isNameQuery(text) {
    const lower = text.toLowerCase();
    return /\b(what'?s?\s*your name|who are you|jina lako|una jina gani|wewe ni nani|your name)\b/.test(lower);
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Amri hii ni ya mmiliki pekee.' }, { quoted: message });
            return;
        }

        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const args = text.split(/\s+/).slice(1).map(a => a.toLowerCase());

        let statusMsg = `🤖 Jibu-Moza (Online AI): *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*\n\nAmri: .autoreply on | off | status`;

        if (!args.length || ['status', 'hali'].includes(args[0])) {
            await sock.sendMessage(chatId, { text: statusMsg }, { quoted: message });
            return;
        }

        if (['on', 'washa', 'enable'].includes(args[0])) cfg.setEnabled(true);
        else if (['off', 'zima', 'disable'].includes(args[0])) cfg.setEnabled(false);
        else {
            await sock.sendMessage(chatId, { text: '⚠️ Amri: on | off | status' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: `✅ Jibu-Moza sasa *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });

    } catch (err) {
        console.error('[autoreplyCommand]', err);
    }
}

async function handleAutoreply(sock, message) {
    try {
        if (!cfg.isEnabled()) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        const isPrivate = /(@s\.whatsapp\.net\( |@c\.us \))/i.test(chatId) && !chatId.endsWith('@g.us');
        if (!isPrivate) return;

        const userText = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            ''
        ).trim();

        if (!userText || userText.startsWith('.') || userText.startsWith('!')) return;

        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();

        let state = userStates.get(userId) || { lastTime: 0, stage: 'new', reminderCount: 0 };
        const timeSinceLast = now - state.lastTime;

        if (timeSinceLast < RATE_LIMIT_MS) return;

        const isSw = isSwahili(userText);
        let reply = null;

        // Special: Direct name answer (bypass API for consistency)
        if (isNameQuery(userText)) {
            reply = FALLBACKS.name(isSw);
        }
        // Greeting: Use API normally (it will respond naturally)
        else if (isGreeting(userText) && state.stage === 'new') {
            reply = FALLBACKS.welcome(isSw); // Warm welcome for first contact
        }
        else {
            // Main: Call API with only "You are Mickey" prompt
            reply = await askMickeyAI(userText, isSw);

            // If API fails or empty → fallback reminder
            if (!reply || reply.length < 2) {
                reply = state.stage === 'new' 
                    ? FALLBACKS.welcome(isSw)
                    : FALLBACKS.reminder(isSw, state.reminderCount);
            }
        }

        // Determine new stage
        let newStage = 'chatting';
        let reminderCount = (state.reminderCount || 0) + 1;

        if (timeSinceLast > 1000 * 60 * 60 * 4) { // >4 hours
            newStage = 'new';
            reminderCount = 0;
        } else if (timeSinceLast < 1000 * 60 * 10) { // <10 min → poking
            newStage = 'waiting';
        }

        // Update state
        userStates.set(userId, { lastTime: now, stage: newStage, reminderCount });

        await sock.sendMessage(chatId, { text: reply }, { quoted: message }).catch(() => {});

    } catch (err) {
        console.error('[handleAutoreply]', err);
    }
}

function isAutoreplyEnabled() {
    return cfg.isEnabled();
}

module.exports = {
    autoreplyCommand,
    isAutoreplyEnabled,
    handleAutoreply
};