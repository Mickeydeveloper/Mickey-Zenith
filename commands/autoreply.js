'use strict';

/**
 * Autoreply Module - Improved Business Prompt Only Version (Jan 2026)
 * - NO API used
 * - Rule-based responses with keyword matching
 * - Auto-detects language (Swahili/English) and replies in the same language
 * - First message detection: Special welcome + "nitakujibu haraka"
 * - Follow-up messages: Reminds "Mickey amepata ujumbe wako, atajibu hivi karibuni"
 * - More natural, varied responses
 * - Mickey: From Tanzania, lives in Dar es Salaam
 * - Private chats only, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');

// Store last interaction time per user to detect "first message of the day/session"
const recentUsers = new Map(); // userId → last timestamp
const RATE_LIMIT_MS = 3500;
const FIRST_MESSAGE_THRESHOLD_HOURS = 6; // If no message in last 6 hours → treat as first message

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

// Simple Swahili detector
function isSwahili(text) {
    const swahiliIndicators = ['habari', 'mambo', 'salama', 'asante', 'karibu', 'ndio', 'hapana', 'sawa', 'poa', 'mzuri', 'jambo', 'shikamoo', 'tafadhali', 'kwaheri', 'lala', 'asubuhi', 'mchana', 'jioni'];
    const lowerText = text.toLowerCase().replace(/[^a-z]/g, ' ');
    return swahiliIndicators.some(word => lowerText.includes(word));
}

// Response database
const RESPONSES = {
    swahili: {
        firstMessage: [
            'Habari! Karibu sana 🇹🇿\nMimi ni Mickey, rafiki yako kutoka Dar es Salaam.\nNimepokea ujumbe wako, nitakujibu haraka iwezekanavyo!',
            'Jambo rafiki! 🎉\nMickey hapa, niko Dar es Salaam. Nimeona sms yako, nitakureply hivi karibuni!',
            'Mambo! 😊\nMickey amepokea ujumbe wako. Niko hapa, nitakujibu kadri niwezavyo haraka!'
        ],
        followUpReminder: [
            'Mickey amepata ujumbe wako, atajibu haraka iwezekanavyo. Subiri kidogo rafiki! ⏳',
            'Nimeona sms yako mpya. Mickey atakuandikia hivi punde! 😊',
            'Ujumbe umefika salama. Mickey atareply soon!'
        ],
        greetings: ['Habari yako?', 'Mambo vipi?', 'Jambo!', 'Salama?', 'Poa?'],
        howareyou: ['Mzima kabisa, asante! Na wewe je?', 'Poa sana! Habari zako?', 'Salama tu, asante kwa kuuliza!'],
        fine: ['Sawa basi!', 'Vizuri!', 'Poa tu!'],
        tanzania: ['Ninatoka Tanzania, naishi Dar es Salaam! 🇹🇿 Unatoka wapi wewe?', 'Dar ndio home! Unapenda Tz?'],
        love: ['Aww, nakupenda pia! ❤️', 'Asante sana rafiki! 😘'],
        thanks: ['Karibu sana!', 'Starehe yako!', 'Karibu tena!'],
        bye: ['Kwaheri, tuonane tena!', 'Lala salama!', 'Baadaye!'],
        default: ['Samahani, sikuelewa vizuri. Unaweza kurudia?', 'Sema zaidi nifahamu!', 'Niko hapa, endelea tu!']
    },
    english: {
        firstMessage: [
            'Hey there! Welcome 🇹🇿\nI\'m Mickey, your friend from Dar es Salaam.\nI\'ve received your message and will reply as soon as possible!',
            'Hi! 🎉\nMickey here from Dar es Salaam. Got your text, I\'ll get back to you soon!',
            'Hello friend! 😊\nMickey has seen your message. I\'ll respond quickly!'
        ],
        followUpReminder: [
            'Mickey has received your message and will reply as soon as he can. Hang on! ⏳',
            'I saw your new text. Mickey will reply shortly! 😊',
            'Message received safely. Mickey will get back to you soon!'
        ],
        greetings: ['Hey!', 'What\'s up?', 'Hi there!', 'Hello!'],
        howareyou: ['I\'m great, thanks! How about you?', 'Doing awesome! And you?', 'All good here!'],
        fine: ['Cool!', 'Nice!', 'Great!'],
        tanzania: ['I\'m from Tanzania, living in Dar es Salaam! 🇹🇿 Where are you from?', 'Dar is home! Do you like TZ?'],
        love: ['Aww, I love you too! ❤️', 'Thanks friend! 😘'],
        thanks: ['You\'re welcome!', 'Anytime!', 'Welcome!'],
        bye: ['Bye, talk soon!', 'Good night!', 'Later!'],
        default: ['Sorry, didn\'t catch that. Can you say it again?', 'Tell me more!', 'I\'m here, keep going!']
    }
};

function getReply(userText, isSw, isFirstMessage, isFollowUp) {
    const lower = userText.toLowerCase();
    const res = isSw ? RESPONSES.swahili : RESPONSES.english;

    // Priority 1: First message of the session
    if (isFirstMessage) {
        return res.firstMessage[Math.floor(Math.random() * res.firstMessage.length)];
    }

    // Priority 2: Follow-up reminder (every message after first, if within short time)
    if (isFollowUp) {
        return res.followUpReminder[Math.floor(Math.random() * res.followUpReminder.length)];
    }

    // Normal conversation responses
    if (lower.match(/(habari|jambo|mambo|salama|shikamoo|hi|hello|hey|sup)/)) {
        return res.greetings[Math.floor(Math.random() * res.greetings.length)];
    }
    if (lower.match(/(je|vipi|how are you|habari yako|unzima)/)) {
        return res.howareyou[Math.floor(Math.random() * res.howareyou.length)];
    }
    if (lower.match(/(mzima|poa|sawa|fine|good|great|okay)/)) {
        return res.fine[Math.floor(Math.random() * res.fine.length)];
    }
    if (lower.match(/(tanzania|dar es salaam|tz|dar|wapi unatoka|where from)/)) {
        return res.tanzania[Math.floor(Math.random() * res.tanzania.length)];
    }
    if (lower.match(/(nakupenda|love you|i love you|❤️)/)) {
        return res.love[Math.floor(Math.random() * res.love.length)];
    }
    if (lower.match(/(asante|thanks|thank you|shukran)/)) {
        return res.thanks[Math.floor(Math.random() * res.thanks.length)];
    }
    if (lower.match(/(kwaheri|bye|goodbye|good night|lala|baadaye)/)) {
        return res.bye[Math.floor(Math.random() * res.bye.length)];
    }

    return res.default[Math.floor(Math.random() * res.default.length)];
}

async function autoreplyCommand(sock, chatId, message) {
    // (Same as before - no changes needed here)
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
        const lastTime = recentUsers.get(userId) || 0;

        // Rate limit
        if (now - lastTime < RATE_LIMIT_MS) return;

        // Detect first message (no contact in last 6 hours)
        const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);
        const isFirstMessage = hoursSinceLast >= FIRST_MESSAGE_THRESHOLD_HOURS || lastTime === 0;
        const isFollowUp = !isFirstMessage && hoursSinceLast < 2; // Within 2 hours → reminder style

        // Update timestamp
        recentUsers.set(userId, now);

        const langIsSwahili = isSwahili(userText);
        const reply = getReply(userText, langIsSwahili, isFirstMessage, isFollowUp);

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