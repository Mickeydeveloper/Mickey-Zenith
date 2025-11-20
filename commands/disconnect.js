
import fs from 'fs';
import path from 'path';
import sender from '../commands/sender.js';
import configManager from '../utils/manageConfigs.js';

const SESSIONS_FILE = path.join(process.cwd(), 'sessions.json');

async function disconnect(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) throw new Error('Message JID is undefined.');

    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    const commandAndArgs = messageBody.slice(1).trim();
    const parts = commandAndArgs.split(/\s+/);
    const args = parts.slice(1);

    let participant;

    // Handle reply to message (try to extract participant JID if present)
    if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        participant = message.message.extendedTextMessage.contextInfo.participant;
    } else if (args.length > 0) {
        participant = args[0];
    } else {
        throw new Error('Specify the person to disconnect. Usage: .disconnect <number>');
    }

    // sanitize number
    const number = String(participant).replace(/[^0-9]/g, '');
    if (!number) throw new Error('Could not parse a valid number from the argument.');

    const sessionPath = path.join(process.cwd(), `sessions/${number}`);

    let removed = false;
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            removed = true;
        } catch (error) {
            await sender(message, client, `❌ Error deleting auth info for ${number}: ${error?.message || error}`);
            return;
        }
    }

    // Update sessions.json
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) || {};
            const list = Array.isArray(data.sessions) ? data.sessions : [];
            const updated = list.filter(n => String(n) !== String(number));
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: updated }, null, 2));
        }
    } catch (e) {
        console.warn('Failed to update sessions.json:', e?.message || e);
    }

    // Clear counters and config entries
    try {
        const cfg = configManager.config || {};
        if (cfg.decryptErrorCounts && cfg.decryptErrorCounts[number]) delete cfg.decryptErrorCounts[number];
        if (cfg.sessionErrorCounts && cfg.sessionErrorCounts[number]) delete cfg.sessionErrorCounts[number];
        if (cfg.badMacCounts && cfg.badMacCounts[number]) delete cfg.badMacCounts[number];
        if (cfg.users && cfg.users[number]) delete cfg.users[number];
        configManager.save();
    } catch (e) {
        console.warn('Failed to clear config counters for removed session:', e?.message || e);
    }

    if (removed) {
        await sender(message, client, `✅ Auth information and session for ${number} deleted successfully.`);
    } else {
        await sender(message, client, `ℹ️ No session folder found for ${number}, but counters/config were cleared if present.`);
    }
}

export default disconnect;
