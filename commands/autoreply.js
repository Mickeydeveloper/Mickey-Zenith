"use strict";

/**
 * Cleaned Autoreply Module
 * - Responds to private messages with a short AI reply
 * - Config stored in `data/autoreply.json`
 * - Owner-only command: `.autoreply on|off|status`
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const isOwnerOrSudo = require("../lib/isOwner");

const CONFIG_PATH = path.join(__dirname, "..", "data", "autoreply.json");
const RATE_LIMIT_MS = 5000;

const userStates = new Map();

class ConfigManager {
    constructor(filePath) {
        this.filePath = filePath;
        this._ensure();
    }

    _ensure() {
        try {
            if (!fs.existsSync(this.filePath)) {
                fs.writeFileSync(this.filePath, JSON.stringify({ enabled: false }, null, 2));
            }
        } catch (e) {
            // ignore
        }
    }

    _read() {
        try {
            return JSON.parse(fs.readFileSync(this.filePath, "utf8")) || { enabled: false };
        } catch (e) {
            return { enabled: false };
        }
    }

    _write(data) {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            // ignore write errors
        }
    }

    isEnabled() {
        return !!this._read().enabled;
    }

    setEnabled(value) {
        const data = this._read();
        data.enabled = !!value;
        this._write(data);
    }

    toggle() {
        const data = this._read();
        data.enabled = !data.enabled;
        this._write(data);
        return data.enabled;
    }
}

const config = new ConfigManager(CONFIG_PATH);

function isSwahili(text) {
    if (!text || typeof text !== "string") return false;
    const swahiliWords = /\b(na|wa|ni|kwa|ya|lakini|ndiyo|hapana|asante|karibu|habari|mambo|jambo|poa|sawa|vizuri|nzuri|sana|leo|kesho|jana|bado|mimi|wewe|yeye|sisi|ninyi|wao)\b/gi;
    const englishWords = /\b(the|and|you|me|is|are|was|to|for|with|but|yes|no|thanks|hello|hi|how|what|where|when|good|more|just|very|also|can|will|would)\b/gi;
    const swCount = (text.match(swahiliWords) || []).length;
    const enCount = (text.match(englishWords) || []).length;
    return swCount > enCount || (swCount > 0 && enCount === 0);
}

function askMickeyAI(userMessage) {
    return new Promise((resolve) => {
        try {
            const prompt = `You are Mickey, a friendly and cool WhatsApp bot. Reply in 1-3 sentences, casually in the same language as user (Swahili or English). Message: "${userMessage}"`;
            const url = `https://okatsu-rolezapiiz.vercel.app/ai/ask?q=${encodeURIComponent(prompt)}`;

            const req = https.get(url, { timeout: 12000 }, (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    try {
                        const json = JSON.parse(data);
                        const reply = json.answer || json.response || json.result || json.text || json.data;
                        const text = typeof reply === "string" ? reply.trim() : null;
                        resolve(text && text.length > 0 ? text : null);
                    } catch (e) {
                        const trimmed = (data || "").toString().trim();
                        resolve(trimmed.length ? trimmed : null);
                    }
                });
            });

            req.on("timeout", () => {
                req.destroy();
                resolve(null);
            });

            req.on("error", () => resolve(null));
        } catch (e) {
            resolve(null);
        }
    });
}

const FALLBACKS = {
    generic: (isSw) => (isSw ? "Nzuri tu! Asante kwa ujumbe. 🙏" : "All good! Thanks for reaching out. 🙏"),
};

function isPrivateChat(chatId) {
    if (!chatId || typeof chatId !== "string") return false;
    return chatId.endsWith("@s.whatsapp.net") && !chatId.endsWith("@g.us");
}

function getMessageText(message) {
    if (!message || !message.message) return "";
    const m = message.message;
    if (m.conversation) return String(m.conversation).trim();
    if (m.extendedTextMessage && m.extendedTextMessage.text) return String(m.extendedTextMessage.text).trim();
    if (m.imageMessage && m.imageMessage.caption) return String(m.imageMessage.caption).trim();
    if (m.videoMessage && m.videoMessage.caption) return String(m.videoMessage.caption).trim();
    return "";
}

function isCommand(text) {
    if (!text || typeof text !== "string") return false;
    return text.startsWith(".") || text.startsWith("/") || text.startsWith("!");
}

async function handleAutoreply(sock, message) {
    try {
        if (!config.isEnabled()) return;
        if (!message || !message.key) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (!isPrivateChat(chatId)) return;

        const userText = getMessageText(message);
        if (!userText || isCommand(userText)) return;

        const userId = message.key.participant || message.key.remoteJid;
        const now = Date.now();
        const state = userStates.get(userId) || { lastReply: 0 };
        if (now - state.lastReply < RATE_LIMIT_MS) return;
        userStates.set(userId, { lastReply: now });

        const isSw = isSwahili(userText);
        let reply = await askMickeyAI(userText);
        if (!reply || reply.length < 2) reply = FALLBACKS.generic(isSw);

        await sock.sendMessage(chatId, { text: reply }, { quoted: message }).catch((e) => console.error("[autoreply] send error", e && e.message));
    } catch (e) {
        console.error("[handleAutoreply]", e);
    }
}

async function autoreplyCommand(sock, chatId, message) {
    try {
        if (!message || !message.key) return;
        const senderId = message.key.participant || message.key.remoteJid;
        const fromMe = message.key.fromMe;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Amri hii ni ya mmiliki pekee / Only owner can use this' }, { quoted: message });
            return;
        }

        const text = getMessageText(message) || "";
        const args = text.split(/\s+/).slice(1);

        if (!args.length || args[0].toLowerCase() === "status") {
            const status = config.isEnabled() ? "✅ ENABLED" : "❌ DISABLED";
            await sock.sendMessage(chatId, { text: `🤖 Autoreply Status: ${status}\n\nUsage: .autoreply on/off` }, { quoted: message });
            return;
        }

        const cmd = args[0].toLowerCase();
        if (cmd === "on" || cmd === "enable") {
            config.setEnabled(true);
            await sock.sendMessage(chatId, { text: "✅ Autoreply is now ENABLED" }, { quoted: message });
        } else if (cmd === "off" || cmd === "disable") {
            config.setEnabled(false);
            await sock.sendMessage(chatId, { text: "❌ Autoreply is now DISABLED" }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: "⚠️ Use: .autoreply on/off/status" }, { quoted: message });
        }
    } catch (e) {
        console.error("[autoreplyCommand]", e);
    }
}

module.exports = {
    handleAutoreply,
    autoreplyCommand,
    isEnabled: () => config.isEnabled(),
    // legacy name expected by main.js
    isAutoreplyEnabled: () => config.isEnabled(),
};