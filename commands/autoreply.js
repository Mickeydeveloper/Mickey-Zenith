'use strict';

/**
 * Mickey Smart AI Autoreply (Jan 2026 Version)
 * Features:
 * - Identity-focused (Mickey)
 * - Dynamic Prompting via API
 * - Smart Language detection
 * - Rate limiting & Context awareness
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const BOT_NAME = "Mickey"; // The central Prompt Name
const RATE_LIMIT_MS = 5000; 

const userStates = new Map();

class ConfigManager {
    constructor(filePath) {
        this.filePath = filePath;
        this._data = this._read();
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
    toggle() { 
        this._data.enabled = !this._data.enabled; 
        this._save(); 
        return this._data.enabled; 
    }
}

const cfg = new ConfigManager(CONFIG_PATH);

/**
 * Core AI Function - Fetches response based on the "Mickey" persona
 */
async function fetchAIReply(userMessage, contextStage) {
    return new Promise((resolve) => {
        // System Prompt: Gives Mickey his personality
        const systemInstruction = `You are ${BOT_NAME}, a friendly and helpful AI assistant. 
        Keep answers short, natural, and human-like. 
        If the user speaks Swahili, reply in Swahili. 
        User Stage: ${contextStage}.`;

        const fullPrompt = `${systemInstruction}\n\nUser: ${userMessage}\n${BOT_NAME}:`;
        const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(fullPrompt)}`;

        const req = https.get(url, { timeout: 10000 }, (res) => {
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
 * Detects if the message is in Swahili to help the AI context
 */
function isSwahili(text) {
    const swahiliKeywords = ['habari', 'mambo', 'vipi', 'jambo', 'asante', 'kaka', 'safi'];
    return swahiliKeywords.some(word => text.toLowerCase().includes(word));
}

async function handleAutoreply(sock, message) {
    try {
        if (!cfg.isEnabled() || message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@s.whatsapp.net')) return; // Private only

        const userText = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        if (!userText || userText.startsWith('.') || userText.startsWith('!')) return;

        const userId = chatId;
        const now = Date.now();
        let state = userStates.get(userId) || { lastTime: 0, count: 0 };

        // Rate Limiting
        if (now - state.lastTime < RATE_LIMIT_MS) return;

        // Determine Conversation Stage
        let stage = "continuing conversation";
        if (now - state.lastTime > 1000 * 60 * 30) stage = "new greeting";

        // Show typing status for "human" feel
        await sock.sendPresenceUpdate('composing', chatId);

        // Get AI Response
        const aiResponse = await fetchAIReply(userText, stage);
        
        // Fallback if API fails
        const fallback = isSwahili(userText) 
            ? `Nimekupata, subiri kidogo ${BOT_NAME} akurudie.` 
            : `I've received your message, ${BOT_NAME} will get back to you soon.`;

        const finalText = aiResponse || fallback;

        await sock.sendMessage(chatId, { text: finalText }, { quoted: message });

        // Update User State
        userStates.set(userId, { lastTime: now, count: state.count + 1 });

    } catch (err) {
        console.error('Autoreply Error:', err);
    }
}

/**
 * Command to turn autoreply on/off
 */
async function autoreplyCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!isOwner) return;

    const status = cfg.toggle();
    const msg = status ? `✅ ${BOT_NAME} Autoreply is now ON` : `❌ ${BOT_NAME} Autoreply is now OFF`;
    
    await sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

module.exports = {
    handleAutoreply,
    autoreplyCommand,
    isAutoreplyEnabled: () => cfg.isEnabled()
};
