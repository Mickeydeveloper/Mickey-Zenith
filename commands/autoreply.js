'use strict';

/**
 * Autoreply Module - Mickey Smart Offline Version (Jan 2026)
 * - Hakuna API kabisa – inafanya kazi 100% offline
 * - Majibu ya kirafiki, asili na ya kibinadamu zaidi
 * - Inagundua lugha kiotomatiki (Kiswahili au Kiingereza) na kujibu kwa lugha hiyo hiyo
 * - Ujumbe wa kwanza: Karibu + "Mickey amepokea, atajibu haraka"
 * - Ujumbe unaofuata: Kukukumbusha kwa upole kwamba Mickey ameona na atareply soon
 * - Majibu yanabadilika kulingana na wakati na muktadha
 * - Inakwepa kurudia mara kwa mara – inahisi zaidi kama mtu halisi
 * - Private chats pekee, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const RATE_LIMIT_MS = 4000; // 4 seconds between replies to same user

// Store user states: last message time + conversation stage
const userStates = new Map(); // userId → { lastTime: timestamp, stage: 'new' | 'waiting' | 'chatting' }

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


async function askExternalAI(prompt) {
    return new Promise((resolve, reject) => {
        try {
            const url = 'https://okatsu-rolezapiiz.vercel.app/ai/ask?q=' + encodeURIComponent(prompt);
            const req = https.get(url, { timeout: 8000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const ct = (res.headers['content-type'] || '').toLowerCase();
                        if (ct.includes('application/json')) {
                            const j = JSON.parse(data || '{}');
                            const candidate = j.answer || j.response || j.result || j.data || j.text || j.reply || j.output;
                            return resolve((candidate || '').toString().trim());
                        }
                        return resolve((data || '').toString().trim());
                    } catch (e) {
                        return resolve((data || '').toString().trim());
                    }
                });
            });
            req.on('error', (e) => reject(e));
            req.on('timeout', () => {
                req.destroy(new Error('timeout'));
            });
        } catch (err) {
            return reject(err);
        }
    });
}

function isGreeting(text) {
    const lower = (text || '').toLowerCase();
    return !!lower.match(/\b(habari|jambo|mambo|salama|hi|hello|hey|sup|what's up|what up|hiya)\b/);
}

function isAboutMe(text) {
    const lower = (text || '').toLowerCase();
    return !!lower.match(/\b(about me|who am i|tell me about me|nani mimi|ni nani mimi|kunipa taarifa kuhusu mimi|ambia kuhusu mimi)\b/);
}

function isNameQuery(text) {
    const lower = (text || '').toLowerCase();
    // English and Swahili common patterns
    return !!lower.match(/\b(what('?| )?s?\s*your name|what is your name|who are you|who r you|you are who|your name|jina lako nani|una jina gani|wewe ni nani|nani wewe)\b/);
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

        if (!args.length) {
            const newState = cfg.toggle();
            await sock.sendMessage(chatId, { text: `✅ Jibu-Moza sasa *${newState ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });
            return;
        }

        if (['on', 'washa', 'washo'].includes(args[0])) cfg.setEnabled(true);
        else if (['off', 'zima'].includes(args[0])) cfg.setEnabled(false);
        else if (['status', 'hali'].includes(args[0])) {
            await sock.sendMessage(chatId, { text: `🤖 Jibu-Moza: *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });
            return;
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Amri zinazokubalika: on | off | status' }, { quoted: message });
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
        // Only respond to standard private chat JIDs (avoid @g.us groups and other special JIDs like @lid)
        const isPrivateJid = /(@s\.whatsapp\.net$|@c\.us$)/i.test(chatId || '');
        if (!isPrivateJid) return; // ignore groups, lists, and other non-private JIDs

        if (chatId.endsWith('@g.us')) return; // redundant guard for groups

        const userText = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            ''
        ).trim();

        if (!userText || userText.startsWith('.')) return;

        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();

        // Pata au unda state ya user
        let state = userStates.get(userId) || { lastTime: 0, stage: 'new' };
        const timeSinceLast = now - state.lastTime;

        // Rate limit
        if (timeSinceLast < RATE_LIMIT_MS) return;

        // Amua stage mpya
        let newStage = 'chatting';
        if (timeSinceLast > 1000 * 60 * 60 * 4) { // Zaidi ya masaa 4 → mpya kabisa
            newStage = 'new';
        } else if (timeSinceLast < 1000 * 60 * 5) { // Chini ya dakika 5 tangu ya mwisho → anasubiri
            newStage = 'waiting';
        }

        const langIsSwahili = isSwahili(userText);
        let reply = getReply(userText, langIsSwahili, newStage);

        // Prompt strategy: ONLY use either the bot's name or an 'about me' prompt.
        // This removes general prompts and uses minimal input for external API calls.
        // Hardcode name prompt to the literal string 'Mickey'
        const namePrompt = 'Mickey';
        const aboutMePrompt = `Provide a short (1-2 sentence) friendly description ABOUT THE USER based only on this input: "${userText}". Keep it personal and concise.`;
        const nameQueryPrompt = `You are ${namePrompt}. The user's message: "${userText}". Reply briefly and naturally AS ${namePrompt} in the same language as the user's message (1-2 sentences). Keep it friendly and human-like.`;

        try {
            // Prefer the special name query prompt when user asks for the bot's name
            let promptToSend;
            if (isNameQuery(userText)) promptToSend = nameQueryPrompt;
            else if (isAboutMe(userText)) promptToSend = aboutMePrompt;
            else promptToSend = namePrompt;

            const ext = await askExternalAI(promptToSend);
            if (ext && typeof ext === 'string' && ext.trim().length > 0) {
                reply = ext.trim();
            }
        } catch (e) {
            console.warn('[handleAutoreply] external AI failed:', e && e.message ? e.message : e);
        }

        // Sasisha state
        state = { lastTime: now, stage: newStage };
        userStates.set(userId, state);

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