/**
 * Enhanced Status Like with On/Off Toggle
 * Reacts with 💚 to all WhatsApp statuses when enabled
 */

import fs from 'fs';
import path from 'path';

// Path to save the status like state
const STATE_FILE = path.join(process.cwd(), 'statusLikeState.json');

// Load or create state
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to load status like state:', err.message);
    }
    // Default state
    return { enabled: true };
}

// Save state
function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error('Failed to save status like state:', err.message);
    }
}

let statusLikeState = loadState();
let lastReactTime = 0;
const REACT_COOLDOWN = 2000; // 2 seconds between reacts to avoid flood

async function statusLike(message, client, prefixOrState = '.') {
    if (!message || !message.key) return;

    // Support being called two ways:
    // - statusLike(message, client, true)  -> called from messageHandler for status events
    // - statusLike(message, client) or statusLike(message, client, '.') -> command parsing
    const isStatusCall = (typeof prefixOrState === 'boolean') ? prefixOrState : false;
    const prefix = (typeof prefixOrState === 'string') ? prefixOrState : '.';

    const remoteJid = message.key.remoteJid;

    // If this is a normal command call (not a status event), handle enable/disable commands
    if (!isStatusCall) {
        const body = (message.body || message.message?.conversation || message.message?.extendedTextMessage?.text || '').toString();
        if (body && body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().toLowerCase();
            const sender = message.key.participant || message.key.remoteJid;

            if (args === 'statuslike on' || args === 'sl on') {
                if (statusLikeState.enabled) {
                    await client.sendMessage(sender, { text: '✅ *Status Like already ENABLED* 💚' });
                } else {
                    statusLikeState.enabled = true;
                    saveState(statusLikeState);
                    await client.sendMessage(sender, { text: '🟢 *Status Like ENABLED* 💚\nNow reacting to all statuses with green heart!' });
                }
                return;
            }

            if (args === 'statuslike off' || args === 'sl off') {
                if (!statusLikeState.enabled) {
                    await client.sendMessage(sender, { text: '🔴 *Status Like already DISABLED*' });
                } else {
                    statusLikeState.enabled = false;
                    saveState(statusLikeState);
                    await client.sendMessage(sender, { text: '🔴 *Status Like DISABLED*\nNo longer reacting to statuses.' });
                }
                return;
            }

            if (args === 'statuslike' || args === 'sl') {
                const status = statusLikeState.enabled ? '🟢 ENABLED' : '🔴 DISABLED';
                await client.sendMessage(sender, { text: `💚 *Status Like*: ${status}\nUse:\n.statuslike on\n.statuslike off` });
                return;
            }
        }

        return; // not a command we handle further
    }

    // === AUTO REACT TO STATUS ONLY IF ENABLED ===
    if (!statusLikeState.enabled) return;

    // Only react to status@broadcast
    if (remoteJid !== 'status@broadcast') return;

    // Skip own status updates
    if (message.key.fromMe) return;

    // Rate limiting to prevent delays/bans
    const now = Date.now();
    if (now - lastReactTime < REACT_COOLDOWN) return;
    lastReactTime = now;

    try {
        // For status reactions, send react to the participant's chat if available, otherwise to status@broadcast
        const chatId = message.key.participant || remoteJid;
        await client.sendMessage(chatId, {
            react: {
                text: '💚',  // Green heart
                key: message.key
            }
        });

        const senderNumber = message.key.participant?.split('@')[0] || 'Unknown';
        console.log(`💚 Liked status from ${senderNumber}`);
    } catch (error) {
        console.error('❌ Failed to react to status:', error?.message || error);
    }
}

export default statusLike;