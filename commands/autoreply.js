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

// Gundua Kiswahili kwa uhakika zaidi
function isSwahili(text) {
    const lower = text.toLowerCase();
    const swahiliWords = [
        'habari', 'mambo', 'jambo', 'salama', 'asante', 'karibu', 'ndio', 'hapana', 'sawa', 'poa',
        'mzuri', 'shikamoo', 'tafadhali', 'kwaheri', 'lala', 'asubuhi', 'mchana', 'jioni', 'vipi',
        'je', 'unaendelea', 'unzima', 'rafiki', 'kaka', 'dada', 'bwana', 'mama', 'baba'
    ];
    return swahiliWords.some(word => lower.includes(word));
}

// Majibu – yameandikwa kwa mtindo wa kibinadamu zaidi
const RESPONSES = {
    swahili: {
        welcome: [
            "Habari rafiki! 🇹🇿\nMimi ni Mickey, niko hapa Dar es Salaam.\nNimepokea ujumbe wako, nitakujibu haraka iwezekanavyo!",
            "Jambo! 😊\nMickey hapa kutoka Dar. Nimeona sms yako, nitakureply hivi karibuni!",
            "Mambo! 🎉\nKaribu sana! Mickey amepata ujumbe wako na atakuandikia mara anapopata nafasi."
        ],
        waiting: [
            "Mickey ameona ujumbe wako mpya. Subiri kidogo, atajibu hivi punde! ⏳",
            "Nimepokea hii pia. Mickey atakuja kukujibu haraka iwezekanavyo rafiki!",
            "Ujumbe umefika salama. Mickey anakuja, ngoja tu kidogo 😊"
        ],
        greeting: [
            "Habari za asubuhi/mchana/jioni!", "Mambo vipi?", "Poa sana huku!", "Salama kabisa!",
            "Jambo rafiki!", "Habari yako leo?"
        ],
        howAreYou: [
            "Mzima kabisa, asante! Na wewe je?", "Poa tu huku Dar, habari zako?",
            "Salama sana, asante kwa kuuliza! Unasemaje wewe?"
        ],
        positive: ["Sawa basi!", "Poa kabisa!", "Vizuri sana!", "Ndio kabisa!", "Bora tu!"],
        location: [
            "Ninatoka Tanzania, naishi Dar es Salaam! 🇹🇿 Unatoka wapi wewe?",
            "Dar ndio home yangu! Unapenda Tanzania?",
            "Hapa Dar es Salaam tu, rafiki! Wewe upo wapi?"
        ],
        affection: ["Aww nakupenda pia! ❤️", "Asante sana kwa maneno mazuri!", "Wewe pia rafiki wangu 😘"],
        thanks: ["Karibu sana!", "Starehe!", "Karibu tena rafiki!", "Asante kwako pia!"],
        goodbye: ["Kwaheri, tuonane tena!", "Lala salama!", "Usiku mwema!", "Baadaye!"],
        fallback: [
            "Samahani sikuelewa vizuri, unaweza kusema tena?",
            "Hebu nijuze zaidi nifahamu 😊",
            "Niko hapa, endelea tu sema unachotaka!"
        ]
    },
    english: {
        welcome: [
            "Hey there! 🇹🇿\nI'm Mickey from Dar es Salaam.\nI've got your message and will reply as soon as I can!",
            "Hi friend! 😊\nMickey here in Dar. Saw your text, I'll get back to you shortly!",
            "Hello! 🎉\nWelcome! Mickey has received your message and will respond soon."
        ],
        waiting: [
            "Mickey saw your new message. He'll reply soon, just hang on! ⏳",
            "Got this one too. Mickey will be with you shortly!",
            "Message received! Mickey's coming to chat soon 😊"
        ],
        greeting: ["Hey!", "What's up?", "Hi there!", "Hello friend!", "How's it going?"],
        howAreYou: [
            "I'm great, thanks! How about you?", "All good here in Dar! And you?",
            "Doing well, thank you for asking! How are you?"
        ],
        positive: ["Cool!", "Awesome!", "Nice one!", "Exactly!", "Perfect!"],
        location: [
            "I'm from Tanzania, living in Dar es Salaam! 🇹🇿 Where are you from?",
            "Dar is my home! Do you like Tanzania?",
            "Right here in Dar es Salaam! Where are you?"
        ],
        affection: ["Aww I love you too! ❤️", "Thanks for the sweet words!", "Right back at you 😘"],
        thanks: ["You're welcome!", "Anytime!", "My pleasure!", "Welcome!"],
        goodbye: ["Bye for now!", "Talk soon!", "Good night!", "Catch you later!"],
        fallback: [
            "Sorry, didn't quite get that. Can you say it again?",
            "Tell me more so I understand 😊",
            "I'm here, just keep talking!"
        ]
    }
};

function getRandomResponse(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getReply(userText, isSw, stage) {
    const lower = userText.toLowerCase();
    const res = isSw ? RESPONSES.swahili : RESPONSES.english;

    // 1. Ujumbe wa kwanza (new conversation)
    if (stage === 'new') {
        return getRandomResponse(res.welcome);
    }

    // 2. Anasubiri jibu (waiting – ameandika zaidi ya moja haraka haraka)
    if (stage === 'waiting') {
        return getRandomResponse(res.waiting);
    }

    // 3. Mazungumzo ya kawaida
    if (lower.match(/(habari|jambo|mambo|salama|shikamoo|hi|hello|hey|sup|what's up)/)) {
        return getRandomResponse(res.greeting);
    }
    if (lower.match(/(je|vipi|how are you|habari yako|unzima|how's it going)/)) {
        return getRandomResponse(res.howAreYou);
    }
    if (lower.match(/(mzima|poa|sawa|fine|good|great|okay|nice|cool)/)) {
        return getRandomResponse(res.positive);
    }
    if (lower.match(/(tanzania|dar es salaam|tz|dar|wapi|where.*from)/)) {
        return getRandomResponse(res.location);
    }
    if (lower.match(/(love|nakupenda|❤️|miss you)/)) {
        return getRandomResponse(res.affection);
    }
    if (lower.match(/(asante|thanks|thank you|shukran)/)) {
        return getRandomResponse(res.thanks);
    }
    if (lower.match(/(kwaheri|bye|goodbye|good night|lala|later)/)) {
        return getRandomResponse(res.goodbye);
    }

    // Default
    return getRandomResponse(res.fallback);
}

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

        // Prepare prompt strategy:
        // - If greeting or 'about me' request -> send a simple, constrained prompt
        // - Otherwise -> use a general conversational prompt
        const useSimple = isGreeting(userText) || isAboutMe(userText);
        const simplePrompt = isAboutMe(userText)
            ? `Provide a short (1-2 sentence) friendly description ABOUT THE USER based only on this input: "${userText}". Keep it personal and concise.`
            : `Provide a short friendly GREETING based on this message: "${userText}". Keep it to one or two short sentences.`;

        const generalPrompt = `You are a friendly conversational assistant. Reply naturally to: "${userText}"`;

        // Try external AI with the chosen prompt (fallback to local rules on failure)
        try {
            const promptToSend = useSimple ? simplePrompt : generalPrompt;
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