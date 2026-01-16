require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { rmSync, existsSync } = require('fs')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1)
    }
}, 30_000)

let phoneNumber = "255615858685"
let owner = {}
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'))
} catch (err) {
    console.warn('⚠️ Could not read owner.json, using default:', err?.message || err)
    owner = {}
}

global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
global.themeemoji = "•"

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

async function startXeonBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Forward outgoing messages as authentic forwarded posts from channel
        // Channel/Media info (used as the origin of forwarded posts)
        const channelRD = { id: '120363398106360290@newsletter', name: '​ 𝕸𝖎𝖈𝖐𝖊𝖞 𝕱𝖗𝖔𝖒 𝕿𝖆𝖓𝖟𝖆𝖓𝖎𝖆 🇹🇿' };
        try {
            const origSendMessage = XeonBotInc.sendMessage.bind(XeonBotInc);
            XeonBotInc.sendMessage = async (jid, message, options = {}) => {
                try {
                    // Only attempt real forwarding for object messages
                    if (!message || typeof message !== 'object') return origSendMessage(jid, message, options);

                    // Don't forward if message already looks forwarded or if target is the channel itself
                    if (message.contextInfo?.isForwarded || jid === channelRD.id) {
                        return origSendMessage(jid, message, options);
                    }

                    // Construct a fake origin message that appears to come from the channel
                    const originalMsg = {
                        key: { remoteJid: channelRD.id, fromMe: false, id: generateMessageID() },
                        message: message
                    };

                    // Create forward payload and generate a WAMessage for the destination
                    const forwardContent = generateForwardMessageContent(originalMsg);
                    const waMessage = generateWAMessageFromContent(jid, forwardContent, {});

                    // Inject forwarded metadata (newsletter info) into the generated message
                    waMessage.message = waMessage.message || {};
                    waMessage.message.contextInfo = waMessage.message.contextInfo || {};
                    waMessage.message.contextInfo.isForwarded = true;
                    waMessage.message.contextInfo.forwardingScore = waMessage.message.contextInfo.forwardingScore || 999;
                    waMessage.message.contextInfo.forwardedNewsletterMessageInfo = waMessage.message.contextInfo.forwardedNewsletterMessageInfo || {
                        newsletterJid: channelRD.id,
                        newsletterName: channelRD.name,
                        serverMessageId: -1
                    };

                    // Relay the message directly (more authentic forwarded appearance)
                    await XeonBotInc.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
                    return waMessage;
                } catch (err) {
                    // If anything fails, fallback to metadata-only send (safe)
                    console.debug && console.debug('Real-forward failed, falling back to metadata-only send:', err && err.message ? err.message : err);

                    // Prepare a safe fallback message object. Don't mutate `message` if it's not an object.
                    let fallbackMessage;
                    if (message && typeof message === 'object') {
                        fallbackMessage = message;
                    } else {
                        // If original message is a primitive (string/number) or undefined,
                        // wrap it into a simple text message so we can attach contextInfo safely.
                        fallbackMessage = { text: String(message || '') };
                    }

                    fallbackMessage.contextInfo = fallbackMessage.contextInfo || {};
                    fallbackMessage.contextInfo.isForwarded = true;
                    fallbackMessage.contextInfo.forwardingScore = 999;
                    fallbackMessage.contextInfo.forwardedNewsletterMessageInfo = fallbackMessage.contextInfo.forwardedNewsletterMessageInfo || {
                        newsletterJid: channelRD.id,
                        newsletterName: channelRD.name,
                        serverMessageId: -1
                    };
                    // Preserve externalAdReply so ad/previews set by commands (help, play, etc.) are not stripped
                    return origSendMessage(jid, fallbackMessage, options);
                }
            };
        } catch (e) {
            console.warn('Could not wrap sendMessage to forward from channel:', e && e.message ? e.message : e);
        }

        // Message handling
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages?.[0]
                if (!mek?.message) return
                
                // Handle ephemeral messages
                if (Object.keys(mek.message)[0] === 'ephemeralMessage') {
                    mek.message = mek.message.ephemeralMessage.message
                }

                // Handle status broadcasts
                if (mek.key?.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }

                // Private mode check for non-owner, non-group messages
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }

                // Skip relay messages
                if (mek.key?.id?.startsWith('BAE5') && mek.key.id.length === 16) return

                // Clear retry cache
                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in messages.upsert:", err?.message || err)
            }
        })

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        XeonBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id)
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
            }
        })

        XeonBotInc.getName = (jid, withoutContact = false) => {
            id = XeonBotInc.decodeJid(jid)
            withoutContact = XeonBotInc.withoutContact || withoutContact
            let v
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = await XeonBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            else v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
                id === XeonBotInc.decodeJid(XeonBotInc.user.id) ? XeonBotInc.user :
                (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        // Pairing Code
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let phoneNumberInput
            if (!!global.phoneNumber) {
                phoneNumberInput = global.phoneNumber
            } else {
                phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 6281376552730 : `)))
            }

            phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '')
            const pn = require('awesome-phonenumber')
            if (!pn('+' + phoneNumberInput).isValid()) {
                console.log(chalk.red('Invalid number. Try again.'))
                process.exit(1)
            }

            setTimeout(async () => {
                let code = await XeonBotInc.requestPairingCode(phoneNumberInput)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
            }, 3000)
        }

        // Connection Update
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
            }

            if (connection === 'open') {
                console.log(chalk.magenta(` `))
                console.log(chalk.yellow(`🌿 Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

                // Optional: Notify bot itself
                try {
                    const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(botJid, {
                        text: `✨ *𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™* is now online!\n\n🕒 Time: ${new Date().toLocaleString()}\n🔋 Status: Active & Ready\n\nType .help for commands`
                    })
                } catch (e) {}

                await delay(2000)

                // === AUTO-FOLLOW CHANNEL (Silent - No Message Sent) ===
                (async () => {
                    try {
                        const channelId = '120363398106360290@newsletter' // ← Change to your channel if different
                        if (!channelId) return

                        // Try to follow using the most common method
                        const followMethods = [
                            'subscribeBroadcast',
                            'subscribeNewsletter',
                            'subscribeToChannel',
                            'followChannel',
                            'follow'
                        ]

                        let isFollowed = false

                        for (const methodName of followMethods) {
                            if (typeof XeonBotInc[methodName] !== 'function') {
                                continue
                            }

                            try {
                                const result = await XeonBotInc[methodName](channelId)
                                // Method succeeded
                                console.log(chalk.green(`✓ Auto-followed channel via ${methodName}: ${channelId}`))
                                isFollowed = true
                                break
                            } catch (err) {
                                // Method failed, try next
                                console.debug(`[AutoFollow] ${methodName} failed: ${err?.message || err}`)
                                continue
                            }
                        }

                        if (!isFollowed) {
                            console.debug(chalk.yellow('⚠️ Auto-follow skipped (method not available).'))
                        }
                    } catch (error) {
                        console.error(chalk.red('✗ Auto-follow error:'), error?.message || error)
                    }
                })()

                // Auto Bio (if you have it)
                try {
                    const autobio = require('./commands/autobio')
                    if (autobio && typeof autobio.applyAutoBioIfEnabled === 'function') {
                        await autobio.applyAutoBioIfEnabled(XeonBotInc)
                    }
                } catch (e) {}

                // Success logs
                console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname} ]`)}\n\n`))
                console.log(chalk.cyan(`< ================================================== >`))
                console.log(chalk.magenta(`${global.themeemoji} WA NUMBER: ${owner}`))
                console.log(chalk.magenta(`${global.themeemoji} CREDIT: 𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™`))
                console.log(chalk.green(`${global.themeemoji} ☀️ Bot Connected Successfully! ✅`))
                console.log(chalk.blue(`Bot Version: ${settings.version}`))
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode

                console.log(chalk.red(`Connection closed: ${lastDisconnect?.error}, Reconnect: ${shouldReconnect}`))

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('Session deleted. Restart and re-authenticate.'))
                }

                if (shouldReconnect) {
                    await delay(5000)
                    startXeonBotInc()
                }
            }
        })

        // Anticall handler
        const antiCallNotified = new Set()
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall')
                const state = readAnticallState()
                if (!state?.enabled) return

                for (const call of calls) {
                    const caller = call.from || call.peerJid
                    if (!caller) continue

                    try {
                        if (typeof XeonBotInc.rejectCall === 'function') {
                            await XeonBotInc.rejectCall(call.id, caller)
                        }
                    } catch (rejectErr) {
                        console.debug('Could not reject call:', rejectErr?.message)
                    }

                    // Send notification once per caller per minute
                    if (!antiCallNotified.has(caller)) {
                        antiCallNotified.add(caller)
                        setTimeout(() => antiCallNotified.delete(caller), 60000)
                        try {
                            await XeonBotInc.sendMessage(caller, { text: '📵 Calls are blocked.' })
                        } catch (e) {
                            console.debug('Could not send anticall message:', e?.message)
                        }
                    }

                    // Block the caller after a short delay
                    setTimeout(async () => {
                        try {
                            await XeonBotInc.updateBlockStatus(caller, 'block')
                        } catch (blockErr) {
                            console.debug('Could not block caller:', blockErr?.message)
                        }
                    }, 1000)
                }
            } catch (err) {
                console.error('[Anticall] Error:', err?.message || err)
            }
        })

        // Group participant update handler
        XeonBotInc.ev.on('group-participants.update', async (update) => {
            try {
                await handleGroupParticipantUpdate(XeonBotInc, update)
            } catch (err) {
                console.error('[GroupParticipant] Error:', err?.message || err)
            }
        })

        return XeonBotInc

    } catch (error) {
        console.error('Fatal error in startXeonBotInc:', error?.message || error)
        await delay(5000)
        startXeonBotInc()
    }
}

// Start bot with error handling
startXeonBotInc().catch(err => {
    console.error('Fatal startup error:', err?.message || err)
    process.exit(1)
})

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err?.message || err)
})

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason?.message || reason)
})

// Auto reload on file change (development)
if (process.env.NODE_ENV !== 'production') {
    let file = require.resolve(__filename)
    fs.watchFile(file, () => {
        fs.unwatchFile(file)
        console.log(chalk.redBright(`🔄 Auto-reloading ${__filename}`))
        delete require.cache[file]
        require(file)
    })
}