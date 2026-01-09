"use strict";

/**
 * Cleaned Autoreply Module
 * - Responds to private messages with a short AI reply
 * - Config stored in `data/autoreply.json`
 * - Owner-only command: `.autoreply on|off|status`
 */

const fs = require("fs");
const path = require("path");
"use strict";

/**
 * Autoreply command - minimal and robust implementation
 * - Uses `data/autoreply.json` to store enabled flag
 * - Exports `handleAutoreply`, `autoreplyCommand`, and `isAutoreplyEnabled`
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'autoreply.json');
const RATE_LIMIT_MS = 5000;

const userStates = new Map();

function ensureConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false }, null, 2));
        }
    } catch (e) {}
}

function readConfig() {
    try {
        ensureConfig();
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) || { enabled: false };
    } catch (e) {
        return { enabled: false };
    }
}

function writeConfig(data) {
    try {
        ensureConfig();
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function isEnabled() {
    return !!readConfig().enabled;
}

function setEnabled(value) {
    const d = readConfig();
    d.enabled = !!value;
    writeConfig(d);
}

function isPrivateChat(jid) {
    return jid && typeof jid === 'string' && jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us');
}

function getMessageText(message) {
    if (!message || !message.message) return '';
    const m = message.message;
    return String(m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '').trim();
}

function isCommand(text) {
    if (!text) return false;
    return String(text).trim().startsWith('.') || String(text).trim().startsWith('/') || String(text).trim().startsWith('!');
}

async function askMickeyAI(userMessage) {
    try {
        const prompt = `You are Mickey, a friendly WhatsApp bot. Reply concisely in same language as user. Message: "${userMessage}"`;
        const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(prompt)}`;
        const res = await axios.get(url, { timeout: 12000 });
        const data = res?.data;
        if (!data) return null;
        const reply = data.answer || data.response || data.result || data.text || (typeof data === 'string' ? data : null) || data.data;
        if (!reply) return null;
        return String(reply).trim();
    } catch (e) {
        return null;
    }
}

const FALLBACK = (isSw) => (isSw ? 'Nzuri tu! Asante kwa ujumbe.' : 'All good! Thanks for reaching out.');

function detectSwahili(text) {
    if (!text) return false;
    const sw = /\b(na|wa|ni|kwa|ya|lakini|ndiyo|hapana|asante|karibu|habari|mambo|jambo|poa|sawa)\b/gi;
    const en = /\b(the|and|you|is|are|to|for|with|but|yes|no|thanks|hello|hi)\b/gi;
    const swCount = (String(text).match(sw) || []).length;
    const enCount = (String(text).match(en) || []).length;
    return swCount > enCount || (swCount > 0 && enCount === 0);
}

async function handleAutoreply(sock, message) {
    try {
        if (!isEnabled()) return;
        if (!message || !message.key) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (!isPrivateChat(chatId)) return;

        const text = getMessageText(message);
        if (!text || isCommand(text)) return;

        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();
        const state = userStates.get(userId) || { lastReply: 0 };
        if (now - state.lastReply < RATE_LIMIT_MS) return;
        userStates.set(userId, { lastReply: now });

        const isSw = detectSwahili(text);
        let reply = await askMickeyAI(text);
        if (!reply || reply.length < 2) reply = FALLBACK(isSw);

        await sock.sendMessage(chatId, { text: reply }, { quoted: message }).catch(() => {});
    } catch (e) {
        console.error('[autoreply] error', e && (e.message || e));
    }
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        if (!message || !message.key) return;
        const senderId = message.key.participant || message.key.remoteJid;
        const fromMe = message.key.fromMe;
        const owner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!fromMe && !owner) {
            await sock.sendMessage(chatId, { text: '❌ Only owner can use this.' }, { quoted: message }).catch(() => {});
            return;
        }

        const raw = getMessageText(message) || '';
        const args = raw.split(/\s+/).slice(1).filter(Boolean);
        if (!args.length || args[0].toLowerCase() === 'status') {
            const status = isEnabled() ? '✅ ENABLED' : '❌ DISABLED';
            await sock.sendMessage(chatId, { text: `Autoreply: ${status}\nUsage: .autoreply on|off|status` }, { quoted: message }).catch(() => {});
            return;
        }

        const cmd = args[0].toLowerCase();
        if (cmd === 'on' || cmd === 'enable') {
            setEnabled(true);
            await sock.sendMessage(chatId, { text: '✅ Autoreply enabled' }, { quoted: message }).catch(() => {});
        } else if (cmd === 'off' || cmd === 'disable') {
            setEnabled(false);
            await sock.sendMessage(chatId, { text: '❌ Autoreply disabled' }, { quoted: message }).catch(() => {});
        } else {
            await sock.sendMessage(chatId, { text: 'Usage: .autoreply on|off|status' }, { quoted: message }).catch(() => {});
        }
    } catch (e) {
        console.error('[autoreplyCommand] error', e && (e.message || e));
    }
}

module.exports = {
    handleAutoreply,
    autoreplyCommand,
    isAutoreplyEnabled: isEnabled,
};