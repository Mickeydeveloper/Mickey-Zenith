import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';


import configManager from '../utils/manageConfigs.js';

import fs from "fs";

import fsp from "fs/promises";

import handleIncomingMessage from '../events/messageHandler.js';

import group from '../commands/group.js'

import autoJoin from '../utils/autoJoin.js'
import notifyOwner from './ownerNotify.js';

const SESSIONS_FILE = "sessions.json";

const sessions = {};

function saveSessionNumber(number) {

    let sessionsList = [];

    if (fs.existsSync(SESSIONS_FILE)) {

        try {

            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE));

            sessionsList = Array.isArray(data.sessions) ? data.sessions : [];

        } catch (err) {

            console.error("Error reading sessions file:", err);

            sessionsList = [];
        }
    }

    if (!sessionsList.includes(number)) {

        sessionsList.push(number);

        fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: sessionsList }, null, 2));
    }
}

function removeSession(number) {

    console.log(`❌ Removing session data for ${number} due to failed pairing.`);

    if (fs.existsSync(SESSIONS_FILE)) {

        let sessionsList = [];

        try {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE));

            sessionsList = Array.isArray(data.sessions) ? data.sessions : [];

        } catch (err) {

            console.error("Error reading sessions file:", err);

            sessionsList = [];
        }

        sessionsList = sessionsList.filter(num => num !== number);

        fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: sessionsList }, null, 2));
    }

    const sessionPath = `./sessions/${number}`;

    if (fs.existsSync(sessionPath)) {

        fs.rmSync(sessionPath, { recursive: true, force: true });
    }


    delete sessions[number];
    try {
        if (configManager && configManager.config) {
            if (configManager.config.decryptErrorCounts) delete configManager.config.decryptErrorCounts[number];
            if (configManager.config.sessionErrorCounts) delete configManager.config.sessionErrorCounts[number];
            if (configManager.config.badMacCounts) delete configManager.config.badMacCounts[number];
            if (configManager.config.users && configManager.config.users[number]) delete configManager.config.users[number];
            configManager.save();
        }
    } catch (e) {
        console.warn('Failed to clean config for removed session:', e?.message || e);
    }

    console.log(`✅ Session for ${number} fully removed.`);
}

async function startSession(targetNumber, handler, n) {

    try {            

            console.log("Starting session for:", targetNumber);

            const sessionPath = `./sessions/${targetNumber}`;

            if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            const sock = makeWASocket({

                auth: state,

                printQRInTerminal: false,

                // Enable full history sync to reduce decryption errors for some multi-device scenarios
                syncFullHistory: true,

                version: [2, 3000, 1027934701],

                markOnlineOnConnect: false

            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {

                const { connection, lastDisconnect } = update;

                if (connection === 'close') {

                    console.log("Session closed for:", targetNumber);

                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                    if (shouldReconnect) {
                        
                        startSession(targetNumber, handler);

                    } else {

                        console.log(`❌ User logged out, removing session for ${targetNumber}`);

                        removeSession(targetNumber);

                       if (targetNumber == configManager.config?.users["root"]?.primary) {

                            configManager.config.users["root"].primary = "";
                            
                            configManager.save();
                        }       
                    }
                } else if (connection === 'open') {

                    console.log(`✅ Session open for ${targetNumber}`);

                    // Attempt to auto-join configured channels (links or ids)
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
                        console.error('Error during auto-join on connection open:', e);
                    }
                        // Notify primary owner if configured to do so
                        try {
                            const notify = configManager.config?.notifyOnConnect ?? true;
                            const primary = configManager.config?.users?.root?.primary;
                            if (notify && primary) {
                                const jid = `${primary}@s.whatsapp.net`;
                                const text = (configManager.config?.messages?.connectionSuccess || '✅ Bot connected to WhatsApp successfully at {time}.').replace('{time}', new Date().toLocaleString());
                                // Use the session socket to send the message
                                await sock.sendMessage(jid, { text });
                                console.log('Notified primary owner about session open:', jid);
                            }
                        } catch (err) {
                            console.error('Failed to notify primary owner about session open:', err);
                        }
                }
            });

            // Setup global error reporting to owner (only once per process)
            try {
                if (!global._ownerErrorReporter) {
                    let notifying = false;

                    const sendOwnerError = async (err, type = 'error') => {
                        try {
                            if (notifying) return;
                            notifying = true;
                            const hostName = process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown-host';
                            const header = `*Automated Error Report*\nType: ${type}\nHost: ${hostName}\n`;
                            const stack = err && (err.stack || JSON.stringify(err, Object.getOwnPropertyNames(err))) || String(err);
                            // Trim to avoid extremely long messages
                            const maxLen = 6000;
                            const body = (header + '\n' + stack).slice(0, maxLen);
                            await notifyOwner(sock, body);
                        } catch (notifyErr) {
                            // avoid infinite loop if notifyOwner fails
                            console.warn('notifyOwner failed while reporting error:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
                        } finally {
                            notifying = false;
                        }
                    };

                    process.on('uncaughtException', (err) => {
                        console.error('UncaughtException:', err && err.stack ? err.stack : err);
                        // fire-and-forget
                        sendOwnerError(err, 'uncaughtException');
                    });

                    process.on('unhandledRejection', (reason) => {
                        console.error('UnhandledRejection:', reason && reason.stack ? reason.stack : reason);
                        sendOwnerError(reason, 'unhandledRejection');
                    });

                    // Optionally forward console.error messages as reports as well
                    const originalConsoleError = console.error.bind(console);
                    console.error = (...args) => {
                        try {
                            originalConsoleError(...args);
                            // Compose a succinct message
                            const message = args.map(a => (typeof a === 'string' ? a : (a && a.stack) ? a.stack : JSON.stringify(a))).join(' ');
                            // don't report if it's the owner notify itself to avoid recursion
                            if (!/Automated Error Report/.test(message)) {
                                sendOwnerError(message, 'console.error');
                            }
                        } catch (e) {
                            // fallback to original
                            originalConsoleError('Error in console.error override:', e);
                        }
                    };

                    global._ownerErrorReporter = true;
                }
            } catch (e) {
                console.warn('Failed to setup owner error reporter:', e && e.message ? e.message : e);
            }


            setTimeout(async () => {

                if (!state.creds.registered) {

                    const code = await sock.requestPairingCode(targetNumber, "MICKEY24");
	                    
	                console.log(`📲 Pairing Code: ${code}`);
	                
	                console.log('👉 Enter this code on your WhatsApp phone app to pair.');
	             }

            }, 5000);

            setTimeout(async () => {

                if (!state.creds.registered) {

                    console.log(`❌ Pairing failed or expired for ${targetNumber}. Removing session.`);

                    removeSession(targetNumber);

                    return;
                }
            }, 60000);

            sock.ev.on('messages.upsert', async (msg) => {
                try {
                    await handler(msg, sock);
                } catch (err) {
                    const sid = sock?.user?.id || sock?.user || 'unknown-sock';
                    // Known decrypt error from underlying library — track and recover
                    if (err && /decrypt/i.test(String(err.message || err))) {
                        console.warn(`⚠️ [${sid}] Failed to decrypt incoming message — tracking. Details:`, err.message || err);
                        try {
                            configManager.config.decryptErrorCounts = configManager.config.decryptErrorCounts || {};
                            const prev = configManager.config.decryptErrorCounts[targetNumber] || 0;
                            const current = prev + 1;
                            configManager.config.decryptErrorCounts[targetNumber] = current;
                            const threshold = configManager.config.decryptErrorThreshold || 5;
                            configManager.save();
                            console.warn(`⚠️ [${sid}] Decrypt error count for ${targetNumber}: ${current}/${threshold}`);
                            if (current >= threshold) {
                                try {
                                    const body = `⚠️ Removing session ${targetNumber} due to repeated decryption failures (${current}).`;
                                    await notifyOwner(sock, body);
                                } catch (e) {
                                    console.warn('Failed to notify owner about decrypt removal:', e?.message || e);
                                }
                                removeSession(targetNumber);
                            }
                        } catch (e) {
                            console.error('Error handling decrypt error count:', e?.message || e);
                        }
                        return;
                    }
                        // Handle libsignal Bad MAC errors which indicate message authentication failed
                        if (err && /bad\s*mac/i.test(String(err.message || err))) {
                            console.warn(`⚠️ [${sid}] Bad MAC / message authentication failed — ignoring message. This can indicate a corrupted or outdated session.`);
                            try {
                                configManager.config.badMacCounts = configManager.config.badMacCounts || {};
                                const prev = configManager.config.badMacCounts[targetNumber] || 0;
                                const current = prev + 1;
                                configManager.config.badMacCounts[targetNumber] = current;
                                const threshold = configManager.config.badMacThreshold || 5;
                                configManager.save();
                                console.warn(`⚠️ [${sid}] Bad MAC count for ${targetNumber}: ${current}/${threshold}`);
                                if (current >= threshold) {
                                    try {
                                        const body = `⚠️ Removing session ${targetNumber} due to repeated Bad MAC errors (${current}).`;
                                        await notifyOwner(sock, body);
                                    } catch (e) {
                                        console.warn('Failed to notify owner about Bad MAC removal:', e?.message || e);
                                    }
                                    removeSession(targetNumber);
                                }
                            } catch (e) {
                                console.error('Error handling Bad MAC count:', e?.message || e);
                            }
                            return;
                        }
                    // Handle libsignal session errors (e.g., 'No sessions') — track and recover
                    if (err && /no sessions|SessionError/i.test(String(err.message || err))) {
                        console.warn(`⚠️ [${sid}] Session error in libsignal — tracking. Details:`, err.message || err);
                        try {
                            configManager.config.sessionErrorCounts = configManager.config.sessionErrorCounts || {};
                            const prev = configManager.config.sessionErrorCounts[targetNumber] || 0;
                            const current = prev + 1;
                            configManager.config.sessionErrorCounts[targetNumber] = current;
                            const threshold = configManager.config.sessionErrorThreshold || 3;
                            configManager.save();
                            console.warn(`⚠️ [${sid}] Session error count for ${targetNumber}: ${current}/${threshold}`);
                            if (current >= threshold) {
                                try {
                                    const body = `⚠️ Removing session ${targetNumber} due to repeated session errors (${current}).`;
                                    await notifyOwner(sock, body);
                                } catch (e) {
                                    console.warn('Failed to notify owner about session error removal:', e?.message || e);
                                }
                                removeSession(targetNumber);
                            }
                        } catch (e) {
                            console.error('Error handling session error count:', e?.message || e);
                        }
                        return;
                    }
                    console.error(`Error in messages.upsert handler [${sid}]:`, err);
                }
            });

            sessions[targetNumber] = sock;

            saveSessionNumber(targetNumber);

            if (n) {


                configManager.config.users[`${targetNumber}`] = {

                    sudoList: [],

                    tagAudioPath: "tag.mp3",

                    antilink: true,

                    response: true,

                    autoreact: false,

                    prefix: "",

                    welcome: false,

                    record: false,

                    type: false, 

                    like: true, 

                    online: true,
                };

                configManager.save();

            }

            // Make sure structure exists before assignment
            configManager.config = configManager.config || {};

            configManager.config.users = configManager.config.users || {};

            configManager.config.users["root"] = configManager.config.users["root"] || {};

            // Now it's safe to assign
            configManager.config.users["root"].primary = `${targetNumber}`;

            configManager.save();

            sock.ev.on('group-participants.update', async (update) => {

                await group.welcome(update,sock);

            });

            return sock;

    } catch (err) {

        console.error("Error creating session :", err);

    }
}

export default startSession;
