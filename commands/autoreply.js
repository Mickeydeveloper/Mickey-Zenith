'use strict';

/**
 * Updated Autoreply Module - Full Swahili Support
 * - All bot replies and messages now in Swahili
 * - Prompt fully in Swahili with character info
 * - About Mickey: From Tanzania, lives in Dar es Salaam
 * - Uses the same reliable API: https://www.apis-codewave-unit-force.zone.id/api/chatsandbox
 * - Keeps rate-limiting, owner commands, private chats only
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const DEBUG = false;

const AXIOS_DEFAULTS = {
    timeout: 20000,
    headers: { 'User-Agent': 'Mickey-Glitch-Bot/1.0', 'Accept': 'application/json' }
};

async function tryRequest(getter, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 700 * (i + 1)));
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

function extractReply(data) {
    if (!data) return null;

    if (data.status === true && data.result && typeof data.result === 'string') {
        return data.result.trim();
    }

    const props = ['reply', 'response', 'text', 'message', 'content'];
    for (const p of props) {
        if (data[p] && typeof data[p] === 'string') return data[p].trim();
    }

    return null;
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Amri ya mmiliki pekee.' }, { quoted: message }).catch(() => {});
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
        if (cmd === 'on' || cmd === 'washo') cfg.setEnabled(true);
        else if (cmd === 'off' || cmd === 'zima') cfg.setEnabled(false);
        else if (cmd === 'status' || cmd === 'hali') {
            await sock.sendMessage(chatId, { text: `🤖 Hali ya Jibu-Moza: *${cfg.isEnabled() ? 'IMEWASHWA' : 'IMEZIMWA'}*` }, { quoted: message });
            return;
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Amri isiyojulikana. Tumia `on`, `off`, au `status`.' }, { quoted: message });
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

        if (DEBUG) console.log('[autoreply] Swali la mtumiaji:', userText);

        const baseURL = 'https://www.apis-codewave-unit-force.zone.id/api/chatsandbox';
        let reply = '🤖 Niko hapa, tafadhali jaribu tena baadaye.';

        try {
            // Full Swahili prompt with character details
            const prompt = `Wewe ni Mickey, chatbot rafiki na mcheshi wa WhatsApp. 
Unatoka Tanzania na unaishi Dar es Salaam. 
Zungumza Kiswahili kizuri, kifupi na cha kirafiki kila wakati. 
Usitumie Kiingereza isipokuwa mtumiaji anatumia.
Jibu kwa ufupi tu, bila maelezo marefu.

Mtumiaji: ${userText}
Mickey:`;

            const res = await tryRequest(() =>
                axios.get(`\( {baseURL}?prompt= \){encodeURIComponent(prompt)}`, AXIOS_DEFAULTS)
            );

            if (DEBUG) console.log('[autoreply] Jibu ghafi la API:', res?.data);

            const candidate = extractReply(res?.data);

            if (candidate && candidate.length > 0 && candidate.length < 1000) {
                reply = candidate;
            } else {
                console.warn('[autoreply] Jibu batili au tupu kutoka API:', res?.data);
                reply = 'Samahani, sikuelewa vizuri. Jaribu tena!';
            }

        } catch (apiErr) {
            if (apiErr.code === 'ECONNABORTED') {
                reply = '⚠️ AI inachukua muda mrefu sasa. Jaribu tena baadaye.';
            } else if (apiErr.response) {
                console.error('[AI API Error] HTTP', apiErr.response.status, apiErr.response.data);
                reply = '⚠️ Huduma ya AI ina tatizo. Jaribu tena hivi karibuni.';
            } else {
                console.error('[AI API Error] Mtandao/Hitilafu:', apiErr.message || apiErr);
                reply = '⚠️ Huduma ya AI haipatikani kwa sasa. Jaribu tena baadaye.';
            }
        }

        if (DEBUG) console.log('[autoreply] Jibu la mwisho:', reply);

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