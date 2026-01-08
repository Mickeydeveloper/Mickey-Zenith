'use strict';

/**
 * Autoreply Module - Mickey Smart ONLINE Version (Fixed - Jan 2026)
 * - Fixed: Now properly extracts "answer" from JSON response
 * - Uses single prompt: "You are Mickey..." + user message
 * - API URL: https://okatsu-rolezapiiz.vercel.app/ai/ask?q=
 * - Robust JSON parsing with multiple fallback fields
 * - If API fails or no answer → uses reliable fallbacks
 * - Special handling for name queries and first messages
 * - Private chats only, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const RATE_LIMIT_MS = 5000;

const userStates = new Map();

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

function isSwahili(text) {
    const swahiliPattern = /\b(na|wa|ni|kwa|ya|lakini|ndiyo|hapana|asante|karibu|habari|mambo|jambo|poa|sawa|vizuri|nzuri|sana|leo|kesho|jana|bado)\b/i;
    const englishPattern = /\b(the|and|you|me|is|are|was|to|for|with|but|yes|no|thanks|hello|hi|how|what|where|when|good|more)\b/i;
    
    const swCount = (text.match(swahiliPattern) || []).length;
    const enCount = (text.match(englishPattern) || []).length;
    
    return swCount > enCount || swCount > 2;
}

// Fixed AI call - properly handles JSON with "answer" field
async function askMickeyAI(userMessage) {
    return new Promise((resolve) => {
        try {
            const fullPrompt = `You are Mickey, a friendly, cool and natural WhatsApp buddy. Reply briefly (1-3 sentences), casually and in the exact same language as the user (Swahili or English). User's message: "${userMessage}"`;

            const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(fullPrompt)}`;

            const req = https.get(url, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data || '{}');
                        // Prioritize "answer" field (confirmed from API)
                        let reply = json.answer || json.response || json.result || json.text || json.reply || json.output || json.data || data;
                        resolve(typeof reply === 'string' ? reply.trim() : null);
                    } catch (e) {
                        // If not JSON, return raw text
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

// Reliable fallbacks
const FALLBACKS = {
    welcome: (sw) => sw 
        ? 'Karibu sana! 🎉 Mickey amepokea ujumbe wako na atajibu hivi karibuni 😊'
        : 'Hey! 🎉 Mickey got your message and will reply soon 😊',

    reminder: (sw, count) => {
        const msgs = sw ? [
            'Mickey ameona... Ata-reply soon 😉',
            'Subiri kidogo tu, Mickey anakuandalia jibu 🌟',
            count > 1 ? 'Asante kwa subira! Mickey atajibu hivi punde 🙏' : 'Mickey amekuelewa vizuri!'
        ] : [
            'Mickey saw it... Reply coming soon 😉',
            'Just a moment, Mickey\'s preparing a reply 🌟',
            count > 1 ? 'Thanks for waiting! Mickey will reply soon 🙏' : 'Mickey got it!'
        ];
        return msgs[Math.min(count || 0, msgs.length - 1)];
    },

    name: (sw) => sw 
        ? 'Mimi ni Mickey, rafiki yako wa hapa WhatsApp! 😎 Unaendelea aje?'
        : 'I\'m Mickey, your WhatsApp buddy here! 😎 How you doing?'
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

        let statusMsg = `🤖 Mickey Autoreply (Online AI): *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*\n\nAmri: .autoreply on | off | status`;

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

        await sock.sendMessage(chatId, { text: `✅ Autoreply sasa *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });

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

        // Special cases
        if (isNameQuery(userText)) {
            reply = FALLBACKS.name(isSw);
        } else if (state.stage === 'new' && isGreeting(userText)) {
            reply = FALLBACKS.welcome(isSw);
        } else {
            // Call AI
            reply = await askMickeyAI(userText);

            // Strong fallback if API returns nothing or fails
            if (!reply || reply.length < 3) {
                reply = state.stage === 'new' 
                    ? FALLBACKS.welcome(isSw)
                    : FALLBACKS.reminder(isSw, state.reminderCount);
            }
        }

        // Update stage
        let newStage = 'chatting';
        let reminderCount = (state.reminderCount || 0) + 1;

        if (timeSinceLast > 1000 * 60 * 60 * 4) {
            newStage = 'new';
            reminderCount = 0;
        } else if (timeSinceLast < 1000 * 60 * 10) {
            newStage = 'waiting';
        }

        userStates.set(userId, { lastTime: now, stage: newStage, reminderCount });

        await sock.sendMessage(chatId, { text: reply }, { quoted: message }).catch(console.error);

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