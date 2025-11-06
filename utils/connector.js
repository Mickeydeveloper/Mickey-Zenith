
import pkg from 'bailey';
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg;


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

                syncFullHistory: false,

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


            setTimeout(async () => {

                if (!state.creds.registered) {

                    const code = await sock.requestPairingCode(targetNumber, "MICKKING");
	                    
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

            sock.ev.on('messages.upsert', async (msg) => handler(msg, sock));

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
