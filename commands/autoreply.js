'use strict';

/**
 * Refactored Autoreply Command
 * - Uses a ConfigManager (sync for compatibility)
 * - Adds rate-limiting per user to avoid spam
 * - Uses AXIOS defaults and a simple retry helper
 * - Cleaner, modular code style
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const DEBUG = false; // set true for verbose logs

const AXIOS_DEFAULTS = {
    timeout: 20000,
    headers: { 'User-Agent': 'Mickey-Glitch-Bot/1.0', 'Accept': 'application/json, text/plain, */*' }
};

async function tryRequest(getter, attempts = 2) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 500 * (i + 1)));
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
        this._data = this._read(); // re-read for external changes
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

// Simple per-user rate limit map
const recentUsers = new Map();
const RATE_LIMIT_MS = 3500; // 3.5s between bot replies per user

function extractReply(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;

    const props = ['result', 'reply', 'response', 'text', 'message', 'content'];
    for (const p of props) {
        if (data[p]) {
            if (typeof data[p] === 'string') return data[p];
            if (typeof data[p] === 'object') {
                if (data[p].text) return data[p].text;
                if (data[p].reply) return data[p].reply;
                if (data[p].content) return data[p].content;
            }
        }
    }

    // Deep fallback: find the first string value
    const stack = [data];
    while (stack.length) {
        const node = stack.shift();
        if (!node) continue;
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) { stack.push(...node); continue; }
        if (typeof node === 'object') {
            for (const v of Object.values(node)) stack.push(v);
        }
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
        if (chatId.endsWith('@g.us')) return; // only private chats

        const userText = (message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '').trim();
        if (!userText) return;
        if (userText.startsWith('.')) return; // don't auto-reply to bot commands

        const userId = message.key.participant || message.key.remoteJid;
        const last = recentUsers.get(userId) || 0;
        const now = Date.now();
        if (now - last < RATE_LIMIT_MS) return; // rate limited
        recentUsers.set(userId, now);

        if (DEBUG) console.log('[autoreply] Query:', userText);

        const apiURL = 'https://api.hanggts.xyz/ai/chatgpt4o';
        let reply = '🤖 I’m here, please try again.';

        try {
            const res = await tryRequest(() => axios.post(apiURL, { text: `You are Mickey, a friendly WhatsApp chatbot. Reply briefly and clearly.\nUser: ${userText}` }, AXIOS_DEFAULTS), 2);
            const candidate = extractReply(res?.data);
            if (candidate && candidate.trim()) reply = candidate.trim();
        } catch (apiErr) {
            console.error('[AI API Error]', apiErr && apiErr.message ? apiErr.message : apiErr);
            reply = '⚠️ AI is busy, please try again shortly.';
        }

        if (DEBUG) console.log('[autoreply] Reply:', reply);
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
