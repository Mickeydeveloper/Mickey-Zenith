'use strict';

/**
 * Autoreply Module - Mickey AI Auto-Reply System
 * - Responds to private messages with AI-generated replies
 * - API: https://okatsu-rolezapiiz.vercel.app/ai/ask?q=
 * - Rate limited to prevent spam
 * - Supports both English and Swahili
 * - Owner commands to enable/disable
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const RATE_LIMIT_MS = 5000;

const userStates = new Map();

// =====================
// CONFIG MANAGER
// =====================
class ConfigManager {
    constructor(filePath) {
        this.filePath = filePath;
        this._ensure();
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

    _write(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    isEnabled() {
        return !!this._read().enabled;
    }

    setEnabled(value) {
        const data = this._read();
        data.enabled = !!value;
        this._write(data);
    }

    toggle() {
        const data = this._read();
        data.enabled = !data.enabled;
        this._write(data);
        return data.enabled;
    }
}

const config = new ConfigManager(CONFIG_PATH);

// =====================
// LANGUAGE DETECTION
// =====================
function isSwahili(text) {
    const swahiliWords = /\b(na|wa|ni|kwa|ya|lakini|ndiyo|hapana|asante|karibu|habari|mambo|jambo|poa|sawa|vizuri|nzuri|sana|leo|kesho|jana|bado|mimi|wewe|yeye|sisi|ninyi|wao)\b/gi;
    const englishWords = /\b(the|and|you|me|is|are|was|to|for|with|but|yes|no|thanks|hello|hi|how|what|where|when|good|more|just|very|also|can|will|would)\b/gi;
    
    const swCount = (text.match(swahiliWords) || []).length;
    const enCount = (text.match(englishWords) || []).length;
    
    return swCount > enCount || (swCount > 0 && enCount === 0);
}

// =====================
// AI API CALL
// =====================
function askMickeyAI(userMessage) {
    return new Promise((resolve) => {
        try {
            const prompt = `You are Mickey, a friendly and cool WhatsApp bot. Reply in 1-3 sentences, casually in the same language as user (Swahili or English). Message: "${userMessage}"`;
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodedPrompt}`;

            const timeoutId = setTimeout(() => {
                req.destroy();
                resolve(null);
            }, 12000);

            const req = https.get(url, { timeout: 12000 }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    clearTimeout(timeoutId);
                    try {
                        const json = JSON.parse(data);
                        const reply = json.answer || json.response || json.result || json.text || json.data;
                        const text = typeof reply === 'string' ? reply.trim() : null;
                        resolve(text && text.length > 0 ? text : null);
                    } catch (e) {
                        resolve(data.trim().length > 0 ? data.trim() : null);
                    }
                });
            });

            req.on('error', () => {
                clearTimeout(timeoutId);
                resolve(null);
            });
        } catch (err) {
            resolve(null);
        }
    });
}

// =====================
// FALLBACK RESPONSES
// =====================
const FALLBACKS = {
    welcome: (isSw) => isSw 
        ? 'Jambo! 👋 Mickey hapa. Karibu sana! 😊'
        : 'Hey! 👋 Mickey here. What\'s up? 😊',

    generic: (isSw) => isSw
        ? 'Nzuri tu! Asante kwa ujumbe. 🙏'
        : 'All good! Thanks for reaching out. 🙏',

    thinking: (isSw) => isSw
        ? 'Najifunza... Tafadhali subiri 🤔'
        : 'Thinking... Give me a moment 🤔'
};

// =====================
// HELPER FUNCTIONS
// =====================
function isPrivateChat(chatId) {
    return chatId && chatId.endsWith('@s.whatsapp.net') && !chatId.endsWith('@g.us');
}

function getMessageText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        ''
    ).trim();
}

function isCommand(text) {
    return text.startsWith('.') || text.startsWith('!') || text.startsWith('/');
}

// =====================
// MAIN AUTOREPLY HANDLER
// =====================
async function handleAutoreply(sock, message) {
    try {
        // Check if enabled
        if (!config.isEnabled()) return;
        
        // Ignore bot's own messages
        if (message.key.fromMe) return;

        // Check if private chat
        const chatId = message.key.remoteJid;
        if (!isPrivateChat(chatId)) return;

        // Extract message text
        const userText = getMessageText(message);
        if (!userText || isCommand(userText)) return;

        // Rate limiting
        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();
        const state = userStates.get(userId) || { lastReply: 0 };

        if (now - state.lastReply < RATE_LIMIT_MS) return;

        userStates.set(userId, { lastReply: now });

        // Determine language
        const isSw = isSwahili(userText);

        // Get AI response
        let reply = await askMickeyAI(userText);

        // Use fallback if AI fails
        if (!reply || reply.length < 2) {
            reply = FALLBACKS.generic(isSw);
        }

        // Send reply
        await sock.sendMessage(chatId, { text: reply }, { quoted: message }).catch(err => {
            console.error('[autoreply] Send error:', err.message);
        });

    } catch (err) {
        console.error('[handleAutoreply] Error:', err);
    }
}

// =====================
// COMMAND HANDLER
// =====================
async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Only owner can use this command' }, { quoted: message });
            return;
        }

        const text = getMessageText(message);
        const args = text.split(/\s+/).slice(1);

        if (!args.length || args[0].toLowerCase() === 'status') {
            const status = config.isEnabled() ? '✅ ENABLED' : '❌ DISABLED';
            await sock.sendMessage(chatId, { 
                text: `🤖 Autoreply Status: ${status}\n\nUsage: .autoreply on/off` 
            }, { quoted: message });
            return;
        }

        const cmd = args[0].toLowerCase();
        if (cmd === 'on' || cmd === 'enable') {
            config.setEnabled(true);
            await sock.sendMessage(chatId, { text: '✅ Autoreply is now ENABLED' }, { quoted: message });
        } else if (cmd === 'off' || cmd === 'disable') {
            config.setEnabled(false);
            await sock.sendMessage(chatId, { text: '❌ Autoreply is now DISABLED' }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Use: .autoreply on/off/status' }, { quoted: message });
        }

    } catch (err) {
        console.error('[autoreplyCommand] Error:', err);
    }
}

// =====================
// EXPORTS
// =====================
module.exports = handleAutoreply;
module.exports.handleAutoreply = handleAutoreply;
module.exports.autoreplyCommand = autoreplyCommand;
module.exports.isEnabled = () => config.isEnabled();