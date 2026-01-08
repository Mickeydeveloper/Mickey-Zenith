'use strict';

/**
 * Mickey Smart AI Autoreply (Fixed & Optimized)
 * - Fixed: Owner detection logic
 * - Uses API with Identity Prompting
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const BOT_NAME = "Mickey"; 
const RATE_LIMIT_MS = 5000; 

const userStates = new Map();

class ConfigManager {
    constructor(filePath) {
        this.filePath = filePath;
        this._ensureDir();
        this._data = this._read();
    }

    _ensureDir() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    _read() {
        try {
            if (!fs.existsSync(this.filePath)) return { enabled: true };
            return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        } catch (e) { return { enabled: true }; }
    }

    _save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2));
    }

    isEnabled() { return !!this._data.enabled; }
    setEnabled(val) { this._data.enabled = val; this._save(); }
    toggle() { 
        this._data.enabled = !this._data.enabled; 
        this._save(); 
        return this._data.enabled; 
    }
}

const cfg = new ConfigManager(CONFIG_PATH);

/**
 * Detect Language (Swahili vs English)
 */
function getLanguage(text) {
    const swahiliWords = ['mambo', 'vipi', 'habari', 'safi', 'mzima', 'asante', 'jambo', 'mambo vipi'];
    const lowerText = text.toLowerCase();
    return swahiliWords.some(word => lowerText.includes(word)) ? 'sw' : 'en';
}

/**
 * Call Mickey AI API
 */
async function askMickeyAI(userText, lang) {
    return new Promise((resolve) => {
        const systemPrompt = `Your name is ${BOT_NAME}. You are a helpful, cool, and friendly person. 
        Reply in ${lang === 'sw' ? 'Swahili' : 'English'}. Keep it short and human-like.`;

        const fullPrompt = `${systemPrompt}\nUser: ${userText}\n${BOT_NAME}:`;
        const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(fullPrompt)}`;

        const req = https.get(url, { timeout: 8000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.answer || json.response || json.result || data;
                    resolve(result.toString().trim());
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
    });
}

/**
 * Handles the actual autoreply logic
 */
async function handleAutoreply(sock, message) {
    try {
        if (!cfg.isEnabled() || message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        // Only trigger in Private Chats
        if (!chatId.endsWith('@s.whatsapp.net')) return;

        const userText = (
            message.message?.conversation || 
            message.message?.extendedTextMessage?.text || 
            message.message?.imageMessage?.caption || ''
        ).trim();

        if (!userText || userText.startsWith('.') || userText.startsWith('!')) return;

        const now = Date.now();
        const state = userStates.get(chatId) || { lastTime: 0 };
        if (now - state.lastTime < RATE_LIMIT_MS) return;

        await sock.sendPresenceUpdate('composing', chatId);

        const lang = getLanguage(userText);
        const aiReply = await askMickeyAI(userText, lang);

        const responseText = aiReply || (lang === 'sw' ? `Nimekupata, ${BOT_NAME} atajibu hivi punde.` : `Got it, ${BOT_NAME} will reply shortly.`);

        await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        userStates.set(chatId, { lastTime: now });

    } catch (err) {
        console.error('[Autoreply Error]', err);
    }
}

/**
 * Command to Turn On/Off (Owner Only)
 */
async function autoreplyCommand(sock, chatId, message) {
    try {
        // FIX: Reliable sender identification
        const sender = message.key.participant || message.key.remoteJid;
        
        // Check permissions
        const isOwner = await isOwnerOrSudo(sender, sock, chatId);

        if (!isOwner) {
            return await sock.sendMessage(chatId, { 
                text: '❌ *Access Denied*\nOnly the bot owner can configure Mickey Autoreply.' 
            }, { quoted: message });
        }

        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').toLowerCase();
        
        if (text.includes('on')) {
            cfg.setEnabled(true);
        } else if (text.includes('off')) {
            cfg.setEnabled(false);
        } else {
            cfg.toggle();
        }

        const status = cfg.isEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
        await sock.sendMessage(chatId, { 
            text: `*Mickey Smart AI*\nStatus: ${status}\n\nUse "on" or "off" to control.` 
        }, { quoted: message });

    } catch (err) {
        console.error('[Command Error]', err);
    }
}

module.exports = {
    handleAutoreply,
    autoreplyCommand,
    isAutoreplyEnabled: () => cfg.isEnabled()
};
