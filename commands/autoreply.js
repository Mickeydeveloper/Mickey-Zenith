'use strict';

/**
 * Autoreply Module - Business Prompt Only (No API) - Jan 2026
 * - Ha tumii API yoyote kabisa
 * - Inafanya kazi kwa Kiswahili na Kiingereza kiotomatiki (detect language ya mtumiaji)
 * - Inabadilisha lugha ya majibu kulingana na lugha ya ujumbe
 * - Mickey: From Tanzania, lives in Dar es Salaam
 * - Private chats only, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');

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
const recentUsers = new Map();
const RATE_LIMIT_MS = 3500;

// Simple language detector: checks common Swahili vs English words
function detectLanguage(text) {
    const lower = text.toLowerCase();
    const swahiliWords = ['habari', 'mambo', 'poa', 'sawa', 'asante', 'karibu', 'ndio', 'hapana', 'kaka', 'dada', 'rafiki', 'tanzania', 'dar', 'salama', 'jambo', 'shikamoo'];
    const englishWords = ['hello', 'hi', 'hey', 'how', 'what', 'where', 'good', 'thanks', 'thank', 'please', 'yes', 'no', 'brother', 'sister', 'friend'];

    let swaCount = 0;
    let engCount = 0;

    swahiliWords.forEach(word => { if (lower.includes(word)) swaCount++; });
    englishWords.forEach(word => { if (lower.includes(word)) engCount++; });

    // If more Swahili words or text contains mostly Swahili indicators
    if (swaCount > engCount || /[\u0100-\u017F]/.test(text)) {  // rough check for non-ASCII (common in Swahili names)
        return 'swahili';
    }
    return 'english';
}

// Business-style prompt templates (no external AI, local generation)
function generateReply(userText, language = 'swahili') {
    const replies = {
        swahili: {
            greeting: ['Habari za mchana?', 'Mambo vipi rafiki?', 'Salamu za Dar es Salaam!', 'Habari yako?', 'Poa sana, wewe je?', 'Karibu sana!'],
            howareyou: ['Mzima kabisa, asante!', 'Niko fiti, wewe?', 'Salama tu hapa Dar!', 'Niko poa, shukran kwa kuuliza.'],
            wherefrom: ['Mimi ni Mickey, natoka Tanzania, naishi Dar es Salaam.', 'Tanzania mzima, Dar ndio home yangu!', 'Asili yangu Tanzania, currently Dar es Salaam.'],
            thanks: ['Karibu sana!', 'Starehe yangu!', 'Asante kwa salamu!', 'Karibu tena!'],
            goodbye: ['Kwa heri rafiki!', 'Tutaonana tena!', 'Usiku mwema!', 'Kaa poa!'],
            default: ['Samahani sikukuelewa vizuri, unaweza kurudia?', 'Sawa, nimekusikia.', 'Habari nyingine?', 'Niko hapa kukuandikia tu!']
        },
        english: {
            greeting: ['Hey there!', 'How are you doing?', 'Hello from Dar es Salaam!', 'Hi friend!', 'What\'s up?', 'Hey, good to hear from you!'],
            howareyou: ['I\'m doing great, thanks!', 'All good here in Dar!', 'Feeling awesome, how about you?', 'I\'m fine, thank you.'],
            wherefrom: ['I\'m Mickey from Tanzania, living in Dar es Salaam.', 'Born in Tanzania, home is Dar es Salaam!', 'Tanzanian through and through, based in Dar.'],
            thanks: ['You\'re welcome!', 'My pleasure!', 'Anytime!', 'Glad to help!'],
            goodbye: ['Take care!', 'See you soon!', 'Have a great day!', 'Bye for now!'],
            default: ['Sorry, I didn\'t quite get that. Can you repeat?', 'Got it!', 'Anything else?', 'I\'m here if you need me!']
        }
    };

    const lower = userText.toLowerCase();
    const dict = replies[language];

    if (lower.includes('habari') || lower.includes('mambo') || lower.includes('jambo') || lower.includes('salamu') || 
        lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        return dict.greeting[Math.floor(Math.random() * dict.greeting.length)];
    }

    if (lower.includes('vzuri') || lower.includes('poa') || lower.includes('fiti') || lower.includes('mzima') ||
        lower.includes('how are you') || lower.includes('how you') || lower.includes('doing')) {
        return dict.howareyou[Math.floor(Math.random() * dict.howareyou.length)];
    }

    if (lower.includes('unatoka') || lower.includes('unaishi') || lower.includes('tanzania') || lower.includes('dar') ||
        lower.includes('where') || lower.includes('from') || lower.includes('live') || lower.includes('tanzania')) {
        return dict.wherefrom[Math.floor(Math.random() * dict.wherefrom.length)];
    }

    if (lower.includes('asante') || lower.includes('shukran') || lower.includes('thank')) {
        return dict.thanks[Math.floor(Math.random() * dict.thanks.length)];
    }

    if (lower.includes('kwa heri') || lower.includes('bye') || lower.includes('goodbye') || lower.includes('lala')) {
        return dict.goodbye[Math.floor(Math.random() * dict.goodbye.length)];
    }

    // Default fallback
    return dict.default[Math.floor(Math.random() * dict.default.length)];
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Amri ya mmiliki pekee.' }, { quoted: message });
            return;
        }

        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const args = text.split(/\s+/).slice(1);

        if (!args.length) {
            const newState = cfg.toggle();
            await sock.sendMessage(chatId, { text: `✅ Jibu-Moza ${newState ? 'IMEWASHWA' : 'IMEZIMWA'}` }, { quoted: message });
            return;
        }

        const cmd = args[0].toLowerCase();
        if (['on', 'washo', 'washa'].includes(cmd)) cfg.setEnabled(true);
        else if (['off', 'zima'].includes(cmd)) cfg.setEnabled(false);
        else if (['status', 'hali'].includes(cmd)) {
            await sock.sendMessage(chatId, { text: `🤖 Hali ya Jibu-Moza: *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });
            return;
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Amri isiyojulikana. Tumia: on | off | status' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: `✅ Jibu-Moza ${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}` }, { quoted: message });

    } catch (err) {
        console.error('[autoreplyCommand]', err);
    }
}

async function handleAutoreply(sock, message) {
    try {
        if (!cfg.isEnabled()) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (chatId.endsWith('@g.us')) return; // Private chats only

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
        const last = recentUsers.get(userId) || 0;
        if (now - last < RATE_LIMIT_MS) return;
        recentUsers.set(userId, now);

        console.log('[autoreply] Ujumbe:', userText);

        // Detect language and generate reply locally
        const language = detectLanguage(userText);
        const reply = generateReply(userText, language);

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