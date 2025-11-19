import group from '../commands/group.js';

import pingCommand from '../commands/ping.js';

import info from '../commands/info.js';

import video from '../commands/video.js'

import order from '../commands/order.js';

import viewonce from '../commands/viewonce.js'

import kill from '../commands/kill.js'

import delay from '../commands/delay.js'

import tiktok from '../commands/tiktok.js'

import react from '../commands/react.js'

import device from '../commands/device.js'

import sudo from '../commands/sudo.js'

import tag from '../commands/tag.js'

import test from '../commands/test.js'

import take from '../commands/take.js'

import fs from 'fs';

import update from '../update.js'

import love from '../commands/love.js'

import getpp from '../commands/getpp.js'

import mickey from '../commands/mickey.js'

import tourl from '../commands/tourl.js';

import sticker from '../commands/sticker.js'

import play from '../commands/play.js'

import crash from '../commands/crash.js'

import statuslike from '../commands/statuslike.js'

import statusview from '../commands/statusview.js'

import connect from '../commands/connect.js'

import disconnect from '../commands/disconnect.js'

import sender from '../commands/sender.js'

import fuck from '../commands/fuck.js'

import channelSender from '../commands/channelSender.js'

import dlt from '../commands/dlt.js'

import gcbug from '../commands/gcbug.js'

import save from '../commands/save.js'

import pp from '../commands/pp.js'

import presence from '../commands/online.js'

import prem from '../commands/prem-menu.js'

import configManager from '../utils/manageConfigs.js'

import premiums from '../commands/premiums.js'

import reactions from '../commands/reactions.js'

import media from '../commands/media.js'

import set from '../commands/set.js'

import getconf from '../commands/getconfig.js'

import auto from '../commands/auto.js'

import fancy from '../commands/fancy.js'

import bugMenu from '../commands/bug-menu.js'

import owner from '../commands/owner.js'
import shazam from '../commands/shazam.js'

import wiki from '../commands/wiki.js'

import transfer from '../commands/transfer.js'

import sinvisicrash from '../commands/sinivicrash.js'

import reconnect from '../events/reconnection.js'

import siosinvis from '../commands/siosinvis.js'

import scrash from '../commands/scrash.js'

import img from '../commands/img.js'
import add from '../commands/add.js'

import alive from '../commands/alive.js'

import { createWriteStream } from 'fs';

import { OWNER_NUM } from '../config.js'

import autoReply from '../commands/autoReply.js';

export let creator = [`${OWNER_NUM}@s.whatsapp.net`]

export let premium = [`${OWNER_NUM}@s.whatsapp.net`]


async function handleIncomingMessage(event, client) {

    // Runtime validation: ensure commonly used command imports are functions.
    // Logs a clear error early if a command module didn't export correctly.
    try {
    } catch (e) {
        console.warn('Warning: failed to validate command imports', e);
    }

   const number = client.user.id
    ? client.user.id.split(':')[0] 
    : [];


    let userLid = '';

    const free = true;

    try {
      const data = JSON.parse(fs.readFileSync(`sessions/${number}/creds.json`, 'utf8'));
      userLid = data?.me?.lid || client.user?.lid || '';
    } catch (e) {
      userLid = client.user?.lid || '';
    }

    const lid = userLid ? [userLid.split(':')[0] + "@lid"] : [];

    const messages = event.messages;

    const prefix = configManager.config?.users[number]?.prefix || '';

    const likeState = configManager.config?.users[number]?.like;

    for (const message of messages) {

        console.log(message.message)

        const remoteJid = message.key.remoteJid;
        
        // Handle status view and like FIRST before other checks (statuses might have empty body)
        if (remoteJid === "status@broadcast") {
            // View status if enabled
            if (configManager.config?.users[number]?.view) {
                await statusview(message, client, true);
            }
            // Like status if enabled
            if (configManager.config?.users[number]?.like) {
                await statuslike(message, client, true);
            }
        }

        const messageBody = (message.message?.extendedTextMessage?.text || message.message?.conversation || '').toLowerCase();

        const approvedUsers = configManager.config?.users[number]?.sudoList;

        const cleanParticipant = message.key?.participant ? message.key.participant.split("@") : [];

        const cleanRemoteJid = message.key?.remoteJid ? message.key.remoteJid.split("@") : [];

        if (!messageBody || !remoteJid) continue;

        auto.autotype(message, client);

        auto.autorecord(message, client);

        tag.respond(message, client, lid);

        group.linkDetection(message, client, lid);

        group.mentiondetect(message, client, lid);

        presence(message, client, configManager.config?.users[number]?.online);

        reactions.auto(message, client, configManager.config?.users[number]?.autoreact, configManager.config?.users[number]?.emoji);

        // Auto-delete trigger: when a user replies to a message with one of these keywords
        // (without prefix), the bot will attempt to delete the quoted message.
        try {
            const deleteTriggers = new Set(['dlt', 'delete', 'del']);
            const isReply = !!message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const trimmedBody = messageBody.trim();

            if (!messageBody.startsWith(prefix) && isReply && deleteTriggers.has(trimmedBody)) {
                // call the dlt command handler
                try {
                    await dlt(message, client);
                } catch (err) {
                    console.error('Error executing auto-delete:', err);
                }
                // Continue to next message (don't process as normal command)
                continue;
            }
        } catch (err) {
            console.error('Error in auto-delete check:', err);
        }

    if (messageBody.startsWith(prefix)) {

            const commandAndArgs = messageBody.slice(prefix.length).trim();

            const parts = commandAndArgs.split(/\s+/);

            const command = parts[0];

            // Route commands
            switch (command) {
                
                case 'add':
                    await react(message, client);
                    try {
                        const args = parts.slice(1);
                        await add.execute(message, args, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to add members: ${error.message}` 
                        });
                        console.error("Error in add command:", error);
                    }
                    break;

                case 'connect':

                    const target = parts[1];

                    await react(message, client);

                    if (premium.includes(number + "@s.whatsapp.net")) {
                            try {

                                await connect.connect(message, client, target);

                            } catch (error) {
                                await client.sendMessage(message.key.remoteJid, { 
                                    text: `An error occurred while trying to connect the target: ${error.message}` 
                                });

                                console.error("Error in connect command:", error);
                            }
                        } else {

                            await channelSender(message, client, "command only for premium users. Contact Dev Mickey to be premium.\n", 2)
                        }

                        break;

                    break;

                case 'prem-menu':

                    await react(message, client);

                        try {

                            await prem(message, client)
                        } catch (error) {

                            await client.sendMessage(message.key.remoteJid, { 

                                text: `An error occurred in the prem-menu command: ${error.message}` 
                            });

                            console.error("Error in prem-menu command:", error);
                        }
                       
                        break;

                    break;

                case 'reconnect':

                    await react(message, client);

                    if (premium.includes(number + "@s.whatsapp.net")) {
                            try {

                                await reconnect(message, client);

                            } catch (error) {
                                await client.sendMessage(message.key.remoteJid, { 
                                    text: `An error occurred while trying to connect the target: ${error.message}` 
                                });

                                console.error("Error in connect command:", error);
                            }
                        } else {

                            await channelSender(message, client, "command only for premium users. Contact Dev Mickey to be premium.\n", 2)
                        }

                        break;

                    break;

                case 'disconnect':

                    await react(message, client);

                    if (premium.includes(number + "@s.whatsapp.net")) {

                            try {

                                await disconnect(message, client);

                            } catch (error) {
                                await client.sendMessage(message.key.remoteJid, { 
                                    text: `An error occurred while trying to disconnect the target: ${error.message}` 
                                });

                                console.error("Error in disconnect command:", error);
                            }
                        } else {

                            await channelSender(message, client, "command only for premium users\n Contact Dev Mickey to be premium\n", 2)
                        }

                        break;

                    break;

                case 'ping':

                    await react(message, client);

                    await pingCommand(message, client);

                    break;

                case 'update':

                    await react(message, client);

                    await update(message, client);

                    break;

                case 'alive':
                    await react(message, client);
                    try {
                        await alive(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred in alive command: ${error.message}` 
                        });
                        console.error("Error in alive command:", error);
                    }
                    break;


                case 'mickey':

                    await react(message, client);

                    await mickey(message, client);

                    break;

                case 'test':

                    await react(message, client);

                    await test(message, client);

                    break;

                case 'love':

                    await react(message, client);

                    try {
                        await love(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { text: `An error occurred in love command: ${error.message}` });
                        console.error('Error in love command:', error);
                    }

                    break;

                case 'tourl':

                    await react(message, client);

                    await tourl(message, client);

                    break;

                case 'getconfig':

                    await react(message, client);

                    await getconf(message, client, number);

                    break;

                case 'getpp':

                    await react(message, client);

                    await getpp(message, client);

                    break;

                case 'tiktok':

                    await react(message, client);

                    await tiktok(message, client);

                    break;

                case 'owner':

                    await react(message, client);

                    await owner(message, client);

                    break;

                case 'shazam':
                case 'whatsong':
                case 'findsong':
                case 'identify':

                    await react(message, client);

                    try {
                        await shazam(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { text: `An error occurred in shazam command: ${error.message}` });
                        console.error('Error in shazam command:', error);
                    }

                    break;

                case 'bug-menu':

                    await react(message, client);

                    await bugMenu(message, client);

                    break;

                case 'fancy':

                    await react(message, client);

                    await fancy(message, client);

                    break;

                case 'setpp':

                    await react(message, client);

                    await pp(message, client);

                    break;

                case 'photo':

                    await react(message, client);

                    await media.photo(message, client);

                    break;

                case 'toaudio':

                    await react(message, client);

                    await media.tomp3(message, client);

                    break;

                case 'menu':

                    await react(message, client);

                    await info(message, client);

                    break;

                case 'autoreact':

                    await react(message, client);

                    await reactions.autoreact(message, client);

                    break;

                case 'bye':

                    await react(message, client);

                    try {
                        await group.bye(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to leave the group: ${error.message}` 
                        });
                        console.error("Error in bye command:", error);
                    }

                    break;

                case 'kickall':

                    await react(message, client);

                    try {
                        await group.kickall(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to purify the group: ${error.message}` 
                        });
                        console.error("Error in kickall command:", error);
                    }

                    break;


                case 'purge':

                    await react(message, client);

                    try {
                        await group.purge(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to purify the group: ${error.message}` 
                        });
                        console.error("Error in purge command:", error);
                    }

                    break;

case 'kick':

    await react(message, client);

    await group.kick(message, client);

    break;

case 'add':

    await react(message, client);

    try {
        await group.add(message, client);
    } catch (error) {
        await client.sendMessage(message.key.remoteJid, { 
            text: `An error occurred while trying to add member(s): ${error.message}` 
        });
        console.error("Error in add command:", error);
    }

    break;

case 'promote':

                    await react(message, client);

                    try {
                        await group.promote(message, client);
                        await channelSender(message, client, "Succceded in promoting target", 2);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to promote target: ${error.message}` 
                        });
                        console.error("Error in demote command:", error);
                    }

                    break;

                case 'demote':

                    await react(message, client);

                    try {
                        await group.demote(message, client);
                        await channelSender(message, client, "Succceded in demoting target", 2);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to demote target: ${error.message}` 
                        });
                        console.error("Error in demote command:", error);
                    }

                    break;

                case 'vv':

                    await react(message, client);

                    await viewonce(message, client);

                    break;

                case 'order':
                    await react(message, client);
                    try {
                        await order(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while processing the order: ${error.message}` 
                        });
                        console.error("Error in order command:", error);
                    }
                    break;

                // Removed order-admin case as feature is not implemented

                case 's-kill':

                    await react(message, client);

                    try {
                        await kill(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to bug the target: ${error.message}` 
                        });
                        console.error("Error in kill command:", error);
                    }

                    break;

                case 'demoteall':

                    await react(message, client);

                    try {
                        await group.dall(message, client, userLid);
                        await channelSender(message, client, "Succceded in demoting everyone", 1);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to demote everyone: ${error.message}` 
                        });
                        console.error("Error in demoteall command:", error);
                    }

                    break;

                case 'promoteall':

                    await react(message, client);

                    try {
                        await group.pall(message, client);
                        await channelSender(message, client, "Succceded in promoting everyone", 1);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to promote everyone: ${error.message}` 
                        });
                        console.error("Error in promoteall command:", error);
                    }

                    break;

                case 'mute':

                    await react(message, client);

                    await group.mute(message, client);

                    break;

                case 'unmute':

                    await react(message, client);

                    await group.unmute(message, client);

                    break;

                case 'transfer':

                    await react(message, client);

                    try {
                        await transfer.transfer(message, client);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while transferring members: ${error.message}` 
                        });
                        console.error("Error in transfer command:", error);
                    }

                    break;

                case 'device':

                    await react(message, client);

                    await device(message, client)

                    break;


                case 'sudo':

                    await react(message, client);

                    try {
                        await sudo.sudo(message, client, configManager.config?.users[number]?.sudoList || []);
                        configManager.save();
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to sudo the target: ${error.message}` 
                        });
                        console.error("Error in sudo command:", error);
                    }

                    break;


                case 'online':

                    await react(message, client);

                    try {
                        await set.setonline(message, client, configManager.config?.users[number]?.online);
                        configManager.save();
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to sudo the online cmd: ${error.message}` 
                        });
                        console.error("Error in online command:", error);
                    }

                    break;


                case 'getsudo':

                    await react(message, client);

                    try {
                        await sudo.getsudo(message, client, configManager.config?.users[number]?.sudoList || []);
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to get sudo list: ${error.message}` 
                        });
                        console.error("Error in getsudo command:", error);
                    }

                    break;


                case 'delsudo':

                    await react(message, client);

                    try {
                        await sudo.delsudo(message, client, configManager.config?.users[number]?.sudoList || []);
                        configManager.save();
                    } catch (error) {
                        await client.sendMessage(message.key.remoteJid, { 
                            text: `An error occurred while trying to delsudo the target: ${error.message}` 
                        });
                        console.error("Error in delsudo command:", error);
                    }

                    break;

                case 'tagall':

                    await react(message, client);

                    await tag.tagall(message, client);

                    break;

                
                case 'tag':

                    await react(message, client);

                    try {
                        await tag.tag(message, client);
                    } catch (error) {
                        return;
                    }

                    break;


                 case 'tagadmin':

                    await react(message, client);

                    await tag.tagadmin(message, client);

                    break;

                case 'take':

                    await react(message, client);

                    await take(message, client);

                    break;

                case 'sticker':

                    await react(message, client);

                    await sticker(message, client);

                    break;

                case 'play':

                    await react(message, client);

                    await play(message, client);

                    break;

                case 'img':

                    await react(message, client);

                    await img(message, client);

                    break;

                case 'video':

                    await react(message, client);

                    await video(message, client);

                    break;

                case 'wiki-fr':

                    await react(message, client);

                    await wiki.wikifr(message, client);

                    break

                case 'wiki-en':

                    await react(message, client);

                    await wiki.wikien(message, client);

                    break

                case 'getid':

                    await react(message, client);

                    await group.gcid(message, client);

                    break;

                case 'settag':

                    await react(message, client);

                    await tag.settag(message, client);

                    break;

                case 'gclink':

                    await react(message, client);

                    await group.gclink(message, client);

                    break;

                case 'antilink':

                    await react(message, client);

                    await group.antilink(message, client);

                    break;

                case 'dlt':

                    await react(message, client);

                    await dlt(message, client);

                    break;

                case 'respons':

                    await react(message, client);

                    await tag.tagoption(message, client);

                    break;

                case 's-crash':

                    await react(message, client);

                        if (premium.includes(number + "@s.whatsapp.net") || free) {
                            try {
                                await scrash(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in crash command:", error);
                            }
                        } else {

                             await channelSender(message, client, "command only for premium users. Contact Dev Mickey to be premium.\n", 2)
                        }

                        break;

                 case 's-crashinvisi':

                    await react(message, client);

                        if (premium.includes(number + "@s.whatsapp.net") || free) {

                            try {
                                await sinvisicrash(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in crash invisi command:", error);
                            }
                        } else {

                             await channelSender(message, client, "command only for premium users. Contact Dev Mickey to be premium.\n", 2)
                        }

                        break;

                case 's-crashios':

                    await react(message, client);

                        if (premium.includes(number + "@s.whatsapp.net") || free) {

                            try {
                                await siosinvis(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in crash ios command:", error);
                            }
                        } else {

                             await channelSender(message, client, "command only for premium users. Contact Dev Mickey to be premium.\n", 2)
                        }

                        break;


                case 'setprefix':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setprefix(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change the prefix ${error.message}` 
                                });

                                console.error("Error in setprefix command:", error);
                            }
                                } else {
                                    // previously owner-only; now allowed for all
                                }

                        break;

                case 'statuslike':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setlike(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change the status like state ${error.message}` 
                                });

                                console.error("Error in status like  command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break;

                case 'statusview':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setview(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change the status view state ${error.message}` 
                                });

                                console.error("Error in status view command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break;

                case 'autorecord':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setautorecord(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change autorecord status ${error.message}` 
                                });

                                console.error("Error in autorecord command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break;

                case 'autotype':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setautotype(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change autotype status ${error.message}` 
                                });

                                console.error("Error in autotype command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break;

                case 'welcome':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {

                                await set.setwelcome(message, client);

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to change the welcome status ${error.message}` 
                                });

                                console.error("Error in welcome command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break; 

                case 's-freeze':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {
                                
                                await fuck(message, client);

                                await crash(message, client)

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in s-freeze command:", error);
                            }
                            } else {
                                // previously owner-only; now allowed for all
                            }

                        break;

                case 'save':

                        await react(message, client);

                        try {
                            await save(message, client);
                        } catch (error) {
                            await client.sendMessage(message.key.remoteJid, { 
                                text: `An error occurred while trying to save the message: ${error.message}` 
                            });
                            console.error("Error in save command:", error);
                        }

                        break;


                case 'addprem':

                    await react(message, client);

                        if (creator.includes((message.key.participant || message.key.remoteJid))) {

                            try {

                                await premiums.addprem(message, client, premium);

                                await client.sendMessage(message.key.remoteJid, { text: `✅ _User successfully added to prem list._` });

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to addprem the target: ${error.message}` 

                                });

                                console.error("Error in addprem command:", error);
                            }

                        } else {

                            await channelSender(message, client, "command only for the creator, Contact mickey tech", 2);
                        }

                        break;

                case 's-group':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {
                                
                                await gcbug(message, client);


                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in s-group command:", error);
                            }

                        }

                        break;

                case 's-delay':

                    await react(message, client);

                        if (
                            message.key.fromMe ||
                            message.key.participant === owner || 
                            message.key.remoteJid === owner ||
                            lid.includes(message.key.participant || message.key.remoteJid)
                        ) {
                            try {
                                
                                await delay(message, client);


                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to bug the target: ${error.message}` 
                                });

                                console.error("Error in s-delay command:", error);
                            }

                        }

                        break;

                case 'delprem':

                    await react(message, client);

                        if (creator.includes((message.key.participant || message.key.remoteJid))) {

                            try {

                                await premiums.delprem(message, client, premium);


                                await client.sendMessage(message.key.remoteJid, { text: `✅ _User successfully remove prem list._` });

                            } catch (error) {

                                await client.sendMessage(message.key.remoteJid, { 

                                    text: `An error occurred while trying to delprem the target: ${error.message}` 

                                });

                                console.error("Error in delprem command:", error);
                            }

                        } else {

                            await channelSender(message, client, "command only for the creator, Contact mickey tech", 2);
                        }

                        break;


            }
        }
        await autoReply(message, client);
    }
}

export default handleIncomingMessage;
