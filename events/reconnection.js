import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

import handleIncomingMessage from '../events/messageHandler.js';

import configManager from '../utils/manageConfigs.js';

import autoJoin from '../utils/autoJoin.js'

import fs from 'fs';

const SESSIONS_FILE = './sessions.json';

const sessions = {};

function removeSession(number) {

    console.log(`❌ Removing session for ${number}`);

    // Remove from sessions.json
    if (fs.existsSync(SESSIONS_FILE)) {

        try {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE));

            const sessionNumbers = Array.isArray(data.sessions) ? data.sessions : [];

            const updated = sessionNumbers.filter(num => num !== number);

            fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: updated }, null, 2));

        } catch (err) {
            
            console.error("❌ Failed to read/write sessions file:", err);
        }
    }

    // Remove session folder
    const sessionPath = `./sessions/${number}`;

    if (fs.existsSync(sessionPath)) {
        
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    // Remove from in-memory sessions
    delete sessions[number];

    console.log(`✅ Session for ${number} fully removed.`);
}

async function reconnect() {

    console.log("Reconnecting All Users You Connected")

    if (!fs.existsSync(SESSIONS_FILE)) return;

    let data;

    try {

        data = JSON.parse(fs.readFileSync(SESSIONS_FILE));

    } catch (err) {

        console.error("❌ Failed to read sessions file:", err);

        return;
    }

    const sessionNumbers = Array.isArray(data.sessions) ? data.sessions : [];

    for (const number of sessionNumbers) {

        if (number === configManager.config.users["root"].primary) continue;

        console.log(`🔄 Reconnecting session for: ${number}`);

        try {

            await startSession(number);

        } catch (err) {

            console.error(`❌ Failed to reconnect session for ${number}:`, err);

            removeSession(number);
        }
    }
}

async function startSession(targetNumber) {

    let count = 1;

    const sessionPath = `./sessions/${targetNumber}`;

    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({

        auth: state,

        printQRInTerminal: false,

        // Enable full history sync to reduce decryption errors for some multi-device scenarios
        syncFullHistory: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {

        const { connection, lastDisconnect } = update;

        if (connection === 'close') {

            console.log(`🔌 Session closed for: ${targetNumber}`);

            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {

                console.log(`🔄 Attempting reconnect for ${targetNumber}...`);

                startSession(targetNumber)

            } else {

                console.log(`🚫 Logged out: removing session for ${targetNumber}`);

                removeSession(targetNumber);
            }

        } else if (connection === 'open') {

            console.log(`✅ Session open for ${targetNumber}`);

        }
    });

        // When a session is established, attempt to auto-join any configured channels/links
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    const channels = configManager.config?.autoJoinChannels ?? [
                        "120363422552152940@newsletter",
                    ];

                    for (const ch of channels) {
                        try {
                            await autoJoin(sock, ch);
                        } catch (e) {
                            console.error(`Failed to autoJoin channel ${ch}:`, e?.message || e);
                        }
                    }
                } catch (e) {
                    console.error('Error while running auto-join on reconnect session open:', e);
                }
            }
        });

    sock.ev.on('messages.upsert', async (msg) => {
        try {
            // Log all message types for debugging
            if (msg.messages?.length > 0) {
                const firstMsg = msg.messages[0];
                const jid = firstMsg.key?.remoteJid;
                console.log(`📨 Message from: ${jid}, Type: ${Object.keys(firstMsg.message || {}).join(',')||'empty'}`);
            }
            await handleIncomingMessage(msg, sock);
        } catch (err) {
            const sid = sock?.user?.id || sock?.user || 'unknown-sock';
            if (err && /decrypt/i.test(String(err.message || err))) {
                console.warn(`⚠️ [${sid}] Failed to decrypt incoming message — ignoring. Details:`, err.message || err);
                return;
            }
            // Ignore session errors from libsignal (corrupted or invalid session)
            if (err && /no sessions|SessionError/i.test(String(err.message || err))) {
                console.warn(`⚠️ [${sid}] Session error in libsignal — ignoring. Details:`, err.message || err);
                return;
            }
            console.error(`Error in messages.upsert handler [${sid}]:`, err);
        }
    });

    // Separate listener for status updates (if available)
    sock.ev.on('messages.update', async (updates) => {
        try {
            console.log(`📊 Messages update event:`, updates.length, 'updates');
            for (const update of updates) {
                console.log(`  - Update:`, JSON.stringify(update).substring(0, 100));
            }
        } catch (err) {
            console.log(`ℹ️ Messages update handler:`, err.message);
        }
    });

    console.log(`✅ Session established for ${targetNumber}`);


    sessions[targetNumber] = sock;
    
    return sock;
}

export default reconnect;
