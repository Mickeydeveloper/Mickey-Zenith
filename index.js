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

let phoneNumber = "255612130873"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

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

        // Message handling
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message

                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }

                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }

                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (mek?.key?.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: `❌ An error occurred: ${String(err.message || err).slice(0, 300)}`
                    }).catch(() => {})
                }
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

                // === FULLY WORKING AUTO-FOLLOW CHANNEL (Silent - No Message Sent) ===
                try {
                    const channelId = '120363398106360290@newsletter' // ← Change to your channel if different

                    // Helper to attempt a named method if present
                    const tryMethod = async (name) => {
                        if (typeof XeonBotInc[name] !== 'function') return null
                        try {
                            return await XeonBotInc[name](channelId)
                        } catch (err) {
                            return err
                        }
                    }

                    const candidateMethods = ['newsletterFollow', 'newsletterSubscribe', 'followChannel', 'subscribeToChannel', 'follow']
                    let followResult = null
                    let usedMethod = null

                    for (const m of candidateMethods) {
                        if (typeof XeonBotInc[m] !== 'function') continue
                        followResult = await tryMethod(m)
                        usedMethod = m

                        // If result is an Error, continue to next method
                        if (followResult instanceof Error) {
                            console.warn(chalk.yellow(`⚠️ ${m} threw an error: ${String(followResult.message || followResult).slice(0,200)}`))
                            followResult = null
                            continue
                        }

                        // Non-error result found — evaluate if it's a success
                        const ok = (
                            followResult === true ||
                            (typeof followResult === 'string' && /ok|success|subscribed|followed/i.test(followResult)) ||
                            (typeof followResult === 'object' && (
                                followResult.ok === true || followResult.success === true || followResult.followed === true || followResult.isFollowed === true || followResult.status === 200 || /ok|success|followed/i.test(String(followResult.status))
                            ))
                        )

                        if (ok) {
                            console.log(chalk.green(`✓ Bot successfully auto-followed WhatsApp Channel via ${m}: ${channelId}`))
                            usedMethod = m
                            break
                        } else {
                            // Unexpected but non-error response — log and treat as non-fatal success (to avoid repeated noisy failures)
                            console.warn(chalk.yellow(`⚠️ ${m} returned unexpected response while trying to follow ${channelId}. Response recorded for debugging.`))
                            console.debug && console.debug(followResult)
                            break
                        }
                    }

                    if (!usedMethod) {
                        console.warn(chalk.yellow('⚠️ No channel follow API available on this Baileys version. Skipping auto-follow.'))
                    }
                } catch (error) {
                    console.error(chalk.red('✗ Failed to follow channel:'), error && error.stack ? error.stack : error)
                }

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
                console.log(chalk.magenta(`\n${global.themeemoji} YT CHANNEL: xxxx`))
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

        // Anticall
        const antiCallNotified = new Set()
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall')
                const state = readAnticallState()
                if (!state.enabled) return

                for (const call of calls) {
                    const caller = call.from || call.peerJid
                    if (!caller) continue

                    try {
                        if (XeonBotInc.rejectCall) await XeonBotInc.rejectCall(call.id, caller)
                    } catch {}

                    if (!antiCallNotified.has(caller)) {
                        antiCallNotified.add(caller)
                        setTimeout(() => antiCallNotified.delete(caller), 60000)
                        await XeonBotInc.sendMessage(caller, { text: '📵 Calls are blocked.' })
                    }

                    setTimeout(async () => {
                        await XeonBotInc.updateBlockStatus(caller, 'block').catch(() => {})
                    }, 1000)
                }
            } catch (e) {}
        })

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update)
        })

        return XeonBotInc

    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

// Start bot
startXeonBotInc().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})

process.on('uncaughtException', console.error)
process.on('unhandledRejection', console.error)

// Auto reload on file change
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})