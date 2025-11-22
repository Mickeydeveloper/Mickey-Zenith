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
// Minimal cooldown so likes happen immediately; set to 0 for no artificial delay
const REACT_COOLDOWN = 0; // milliseconds between reacts

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

    // Minimal rate limiting (no artificial delay) — perform fire-and-forget react so we don't block
    const now = Date.now();
    if (REACT_COOLDOWN > 0 && (now - lastReactTime < REACT_COOLDOWN)) return;
    lastReactTime = now;

    // Send reaction asynchronously (do not await) to keep handler fast
    try {
        const chatId = message.key.participant || remoteJid;
        // fire-and-forget
        client.sendMessage(chatId, {
            react: {
                text: '💚',
                key: message.key
            }
        }).then(() => {
            const senderNumber = message.key.participant?.split('@')[0] || 'Unknown';
            console.log(`💚 Liked status from ${senderNumber}`);
        }).catch((err) => {
            // Non-fatal; debug only
            console.debug('statusLike: react failed', err?.message || err);
        });
    } catch (error) {
        // Shouldn't reach here since sendMessage is async; log debug only
        console.debug('statusLike error:', error?.message || error);
    }
}

export default statusLike;