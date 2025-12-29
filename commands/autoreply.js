/**
 * Autoreply Command – AI Chatbot (Private Chat Only)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const configPath = path.join(__dirname, '..', 'data', 'autoreply.json');
const DEBUG = true;

/* ───────── CONFIG INIT ───────── */
function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

/* ───────── TOGGLE COMMAND ───────── */
async function autoreplyCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Owner only command.' });
        }

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = text.trim().split(/\s+/).slice(1);
        const config = initConfig();

        if (args[0] === 'on') config.enabled = true;
        else if (args[0] === 'off') config.enabled = false;
        else if (args[0] === 'status') {
            return sock.sendMessage(chatId, {
                text: `🤖 Auto-Reply Status: *${config.enabled ? 'ON' : 'OFF'}*`
            });
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        await sock.sendMessage(chatId, {
            text: `✅ Auto-Reply ${config.enabled ? 'ENABLED' : 'DISABLED'}`
        });

    } catch (err) {
        console.error('[autoreplyCommand]', err);
    }
}

/* ───────── STATUS CHECK ───────── */
function isAutoreplyEnabled() {
    try {
        return initConfig().enabled;
    } catch {
        return false;
    }
}

/* ───────── AI RESPONSE PARSER (FIX) ───────── */
function extractReply(data) {
    if (!data) return null;

    if (typeof data === 'string') return data;

    if (data.result) return data.result;
    if (data.reply) return data.reply;
    if (data.response) return data.response;
    if (data.text) return data.text;

    if (data.data) {
        if (typeof data.data === 'string') return data.data;
        if (data.data.content) return data.data.content;
        if (data.data.reply) return data.data.reply;
        if (data.data.text) return data.data.text;
    }

    return null;
}

/* ───────── MAIN CHATBOT HANDLER ───────── */
async function handleAutoreply(sock, message) {
    try {
        if (!isAutoreplyEnabled()) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (chatId.endsWith('@g.us')) return;

        const userText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            '';

        if (!userText || userText.startsWith('.')) return;

        if (DEBUG) console.log('[Chatbot] User:', userText);

        const apiURL = 'https://api.hanggts.xyz/ai/chatgpt4o';

        let reply = '🤖 I’m here, please try again.';

        try {
            const response = await axios.post(
                apiURL,
                {
                    text: `You are Mickey, a friendly WhatsApp chatbot. Reply shortly and clearly.\nUser: ${userText}`
                },
                { timeout: 20000 }
            );

            const aiReply = extractReply(response.data);

            if (aiReply && aiReply.trim().length > 0) {
                reply = aiReply.trim();
            }

        } catch (apiErr) {
            console.error('[AI API Error]', apiErr.message);
            reply = '⚠️ AI is busy, please try again shortly.';
        }

        if (DEBUG) console.log('[Chatbot] Reply:', reply);

        await sock.sendMessage(chatId, { text: reply }, { quoted: message });

    } catch (err) {
        console.error('[handleAutoreply]', err);
    }
}

module.exports = {
    autoreplyCommand,
    isAutoreplyEnabled,
    handleAutoreply
};
