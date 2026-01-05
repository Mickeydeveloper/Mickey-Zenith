'use strict';

/**
 * Autoreply Module - Reliable Version (Jan 2026)
 * - Uses ONLY one FREE working API: apis-codewave-unit-force.zone.id
 * - No key required, no unnecessary fallbacks
 * - Full Swahili support
 * - Mickey: From Tanzania, lives in Dar es Salaam
 * - Private chats only, rate-limited, owner commands
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const DEBUG = true; // Washa hii ili uone logs za API (kwa testing)

const AXIOS_DEFAULTS = {
    timeout: 25000, // Ongeza timeout kidogo
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
    }
};

async function tryRequest(getter, attempts = 4) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw lastErr;
}

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

const API_URL = 'https://www.apis-codewave-unit-force.zone.id/api/chatsandbox';

const getPrompt = (userText) => `
Wewe ni Mickey, chatbot rafiki, mcheshi na mkarimu wa WhatsApp.
Unatoka Tanzania na unaishi Dar es Salaam.
Unapenda kuzungumza Kiswahili kizuri, kifupi na cha kirafiki kila wakati.
Usitumie Kiingereza isipokuwa mtumiaji anatumia.
Jibu kwa ufupi tu (mistari 1-4), bila maelezo marefu au emoji nyingi.
Usianze na "Mimi ni AI".

Mtumiaji: ${userText}
Mickey:`;

function extractReply(data) {
    if (!data) return null;
    if (data.status === true && data.result && typeof data.result === 'string') {
        return data.result.trim();
    }
    return null;
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

        if (DEBUG) console.log('[autoreply] Swali:', userText);

        let reply = '🤖 Niko hapa, tafadhali jaribu tena baadaye.';

        try {
            const prompt = getPrompt(userText);

            const res = await tryRequest(() =>
                axios.get(`\( {API_URL}?prompt= \){encodeURIComponent(prompt)}`, AXIOS_DEFAULTS)
            );

            if (DEBUG) console.log('[autoreply] Jibu la API:', res?.data);

            const candidate = extractReply(res?.data);

            if (candidate && candidate.length > 0 && candidate.length < 1000) {
                reply = candidate;
            } else {
                reply = 'Samahani, sikuelewa vizuri. Jaribu tena!';
            }

        } catch (apiErr) {
            console.error('[AI API Error]:', apiErr.message || apiErr);
            reply = '⚠️ Huduma ya AI ina tatizo kidogo sasa. Jaribu tena baadaye.';
        }

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