'use strict';

/**
 * Refactored Autoreply Module
 * - Uses https://www.apis-codewave-unit-force.zone.id/api/chatsandbox (no API key required)
 * - GET request with ?prompt= (as per your example)
 * - Response format: {"status":true,"result":"generated reply"}
 * - Keeps all original features: ConfigManager, rate-limiting, owner commands, private chats only
 * - Improved extractReply to handle the "result" field perfectly
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const DEBUG = false; // Set to true for verbose logs

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
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)));
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
        this._data = this._read(); // Refresh in case of external changes
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

// Per-user rate limiting
const recentUsers = new Map();
const RATE_LIMIT_MS = 3500; // 3.5 seconds between replies per user

function extractReply(data) {
    if (!data) return null;

    // Primary: check for "result" field (this API uses it)
    if (data.result && typeof data.result === 'string') {
        return data.result.trim();
    }

    // Fallbacks for other possible fields
    const props = ['reply', 'response', 'text', 'message', 'content', 'answer'];
    for (const p of props) {
        if (data[p]) {
            if (typeof data[p] === 'string') return data[p].trim();
            if (typeof data[p] === 'object' && data[p].text) return data[p].text.trim();
        }
    }

    // Deep search for any string
    const stack = [data];
    while (stack.length) {
        const node = stack.shift();
        if (typeof node === 'string' && node.trim()) return node.trim();
        if (Array.isArray(node)) stack.push(...node);
        if (node && typeof node === 'object') stack.push(...Object.values(node));
    }

    return null;
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: message }).catch(() => {});
            return;
        }

        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const args = text.split(/\s+/).slice(1);

        if (!args.length) {
            const newState = cfg.toggle();
            await sock.sendMessage(chatId, { text: `✅ Auto-Reply ${newState ? 'ENABLED' : 'DISABLED'}` }, { quoted: message });
            return;
        }

        const cmd = args[0].toLowerCase();
        if (cmd === 'on') cfg.setEnabled(true);
        else if (cmd === 'off') cfg.setEnabled(false);
        else if (cmd === 'status') {
            await sock.sendMessage(chatId, { text: `🤖 Auto-Reply Status: *${cfg.isEnabled() ? 'ON' : 'OFF'}*` }, { quoted: message });
            return;
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Unknown subcommand. Use `on`, `off`, or `status`.' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: `✅ Auto-Reply ${cfg.isEnabled() ? 'ENABLED' : 'DISABLED'}` }, { quoted: message });

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

        if (!userText || userText.startsWith('.')) return; // Ignore empty or bot commands

        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();
        const last = recentUsers.get(userId) || 0;
        if (now - last < RATE_LIMIT_MS) return;
        recentUsers.set(userId, now);

        if (DEBUG) console.log('[autoreply] User query:', userText);

        const baseURL = 'https://www.apis-codewave-unit-force.zone.id/api/chatsandbox';
        let reply = '🤖 I’m here, please try again later.';

        try {
            const prompt = `You are Mickey, a friendly and concise WhatsApp chatbot. Reply naturally and briefly.\nUser: ${userText}\nMickey:`;

            const res = await tryRequest(() =>
                axios.get(`\( {baseURL}?prompt= \){encodeURIComponent(prompt)}`, AXIOS_DEFAULTS)
            );

            const candidate = extractReply(res?.data);
            if (candidate && candidate.length > 0 && candidate.length < 1500) {
                reply = candidate;
            }

            if (DEBUG) console.log('[autoreply] Raw API response:', res?.data);

        } catch (apiErr) {
            console.error('[AI API Error]', apiErr?.response?.data || apiErr.message || apiErr);
            reply = '⚠️ AI service is temporarily unavailable. Try again soon.';
        }

        if (DEBUG) console.log('[autoreply] Final reply:', reply);

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