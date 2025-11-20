import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

import configManager from '../utils/manageConfigs.js';
import sender from '../utils/sender.js';


async function connectToWhatsApp(handleMessage) {

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({ auth: state, printQRInTerminal: true, syncFullHistory: false });

    sock.ev.on('connection.update', async (update) => {

        const { connection, lastDisconnect } = update;

        if (connection === 'close') {

            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) connectToWhatsApp(handleMessage);

        } else if (connection === 'open') {

            console.log('\u2705 WhatsApp connection established and ready.');

            // If notifyOnConnect is enabled and a primary owner is set in the config, try to notify them via WhatsApp
            try {
                const notify = configManager.config?.notifyOnConnect ?? true;
                const primary = configManager.config?.users?.root?.primary;

                if (notify && primary && sock.sendMessage) {
                    const template = configManager.config?.messages?.connectionSuccess || '✅ Bot connected to WhatsApp successfully at {time}.';
                    const text = template.replace('{time}', new Date().toLocaleString());
                    const jid = `${primary}@s.whatsapp.net`;
                    await sock.sendMessage(jid, { text });
                }
            } catch (err) {
                console.error('Failed to notify primary owner about connection:', err);
            }
        }

    });

    sock.ev.on('messages.upsert', async (msg) => {
        try {
            await handleMessage(msg, sock);
        } catch (err) {
            const sid = sock?.user?.id || sock?.user || 'unknown-sock';
            const msgErr = String(err.message || err || '');
            if (/decrypt/i.test(msgErr)) {
                console.warn(`⚠️ [${sid}] Failed to decrypt incoming message during auth — tracking. Details:`, msgErr);
                try {
                    configManager.config.decryptErrorCounts = configManager.config.decryptErrorCounts || {};
                    const prev = configManager.config.decryptErrorCounts['auth'] || 0;
                    const current = prev + 1;
                    configManager.config.decryptErrorCounts['auth'] = current;
                    const threshold = configManager.config.decryptErrorThreshold || 5;
                    configManager.save();
                    console.warn(`⚠️ [${sid}] Auth decrypt error count: ${current}/${threshold}`);
                } catch (e) {
                    console.error('Error incrementing auth decrypt error count:', e?.message || e);
                }
                return;
            }
            if (/bad\s*mac/i.test(msgErr)) {
                console.warn(`⚠️ [${sid}] Bad MAC / message authentication failed — ignoring message. This can indicate a corrupted or outdated session.`);
                try {
                    configManager.config.badMacCounts = configManager.config.badMacCounts || {};
                    const prev = configManager.config.badMacCounts['auth'] || 0;
                    configManager.config.badMacCounts['auth'] = prev + 1;
                    configManager.save();
                    console.warn(`⚠️ [${sid}] Incremented auth bad MAC counter: ${configManager.config.badMacCounts['auth']}`);
                } catch (e) {
                    console.error('Error incrementing auth Bad MAC counter:', e?.message || e);
                }
                return;
            }
            // Handle session errors in auth flow — track counts for visibility
            if (/no sessions|SessionError/i.test(msgErr)) {
                console.warn(`⚠️ [${sid}] Session error in libsignal during auth — tracking. Details:`, msgErr);
                try {
                    configManager.config.sessionErrorCounts = configManager.config.sessionErrorCounts || {};
                    const prev = configManager.config.sessionErrorCounts['auth'] || 0;
                    const current = prev + 1;
                    configManager.config.sessionErrorCounts['auth'] = current;
                    const threshold = configManager.config.sessionErrorThreshold || 3;
                    configManager.save();
                    console.warn(`⚠️ [${sid}] Auth session error count: ${current}/${threshold}`);
                } catch (e) {
                    console.error('Error incrementing auth session error count:', e?.message || e);
                }
                return;
            }
            console.error(`Error in messages.upsert handler [${sid}]:`, err);
        }
    });
    
    sock.ev.on('creds.update', saveCreds);

    return sock;
}

export default connectToWhatsApp;
