
import configManager from '../utils/manageConfigs.js';

import channelSender from '../commands/channelSender.js'
import notifyOwner from '../utils/ownerNotify.js';

function isEmoji(str) {

    const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;

    return emojiRegex.test(str);
}

async function setprefix(message, client) {

    const number = client.user.id.split(':')[0];

    try {

        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) {

            throw new Error("Message JID is undefined.");
        }

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim();

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1);

        if (args.length > 0) {

            const prefix = args[0];

            configManager.config.users[number] = configManager.config.users[number] || {};      

            if (configManager.config && configManager.config.users[number]) {
    
                configManager.config.users[number].prefix = prefix;

            }

            configManager.save()

            await channelSender(message, client, "prefix changed successfully", 1);

        } else if (args.length <= 0) {

            const prefix = args;

            configManager.config.users[number] = configManager.config.users[number] || {};  

            if (configManager.config && configManager.config.users[number]) {
                
                configManager.config.users[number].prefix = "";

            }

            configManager.save()

            await channelSender(message, client, "prefix changed successfully", 1);

        } else{

            await channelSender(message, client, "prefix was not changed successfully", 2); 

            throw new Error('Specify the prefix.');

        }
        

    } catch (error) {

        await client.sendMessage(message.key.remoteJid, { text: `An error occurred while trying to modify the prefixt: ${error.message}` });
    }
}

async function setreaction(message, client) {

    const number = client.user.id.split(':')[0];

    try {

        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) {

            throw new Error("Message JID is undefined.");
        }

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim();

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1);

        if ((args.length > 0) && isEmoji(args)) {

            const reaction = args[0];

            configManager.config.users[number] = configManager.config.users[number] || {};  

            if (configManager.config && configManager.config.users[number]) {
                
                configManager.config.users[number].reaction = reaction;

            }

            configManager.save()

            await channelSender(message, client, "reaction changed successfully", 1);

        }  else{

            await channelSender(message, client, "reaction was not changed successfully", 2); 

            throw new Error('Specify the emoji.');

        }
        

    } catch (error) {

        await client.sendMessage(message.key.remoteJid, { text: `An error occurred while trying to modify the reaction emoji: ${error.message}` });
    }
}


export async function setwelcome(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) return;

    try {

        if (args.join(' ').toLowerCase().includes("on")) {

            if (configManager.config && configManager.config.users[number]) {
                
                configManager.config.users[number].welcome = true;

            }

            configManager.save();

            await channelSender(message, client, "Welcome has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].welcome = false;

            }

            configManager.save();

            await channelSender(message, client, "Welcome has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 1); 
        }
    } catch (error) {

        console.error("_Error changing the welcome:_", error);
    }
}


export async function setautorecord(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager?.config?.users[number]) return;

    try {

        if (args.join(' ').toLowerCase().includes("on")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                  configManager.config.users[number].record = true;

            }

            configManager.save();

            await channelSender(message, client, "autorecord has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                  configManager.config.users[number].record = false;

            }

            configManager.save();

            await channelSender(message, client, "autorecord has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 2); 
        }
    } catch (error) {

        console.error("_Error changing the welcome:_", error);
    }
}


export async function setautotype(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) return;

    try {

        if (args.join(' ').toLowerCase().includes("on")) {

            if (configManager.config && configManager.config.users[number]) {

                configManager.config.users[number].type = true;

            }

            configManager.save();

            await channelSender(message, client, "autotype has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {


            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].type = false;

            }

            configManager.save();

            await channelSender(message, client, "autotype has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 2); 
        }
    } catch (error) {

        console.error("_Error changing the welcome:_", error);
    }
}

export async function setautoreply(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) configManager.config.users[number] = {};

    try {

        const lower = args.join(' ').toLowerCase();

        if (!lower || lower.length === 0) {
            // show current status
            const cfg = configManager.config.users[number];
            const enabled = cfg.autoreply === undefined ? true : !!cfg.autoreply;
            const scope = cfg.autoreplyScope || 'private';
            await channelSender(message, client, `Auto-reply is *${enabled ? 'ENABLED' : 'DISABLED'}* \nScope: *${scope}*`, 1);
            return;
        }

        if (lower.includes("on")) {
            configManager.config.users[number].autoreply = true;
            configManager.save();
            await channelSender(message, client, "Auto-reply has been turned ON", 1);
            return;
        }

        if (lower.includes("off")) {
            configManager.config.users[number].autoreply = false;
            configManager.save();
            await channelSender(message, client, "Auto-reply has been turned OFF", 1);
            return;
        }

        // set scope: private/groups/all
        if (lower.includes('scope')) {
            if (lower.includes('groups')) {
                configManager.config.users[number].autoreplyScope = 'groups';
                configManager.save();
                await channelSender(message, client, "Auto-reply scope set to: groups", 1);
                return;
            }
            if (lower.includes('all')) {
                configManager.config.users[number].autoreplyScope = 'all';
                configManager.save();
                await channelSender(message, client, "Auto-reply scope set to: all", 1);
                return;
            }
            if (lower.includes('private')) {
                configManager.config.users[number].autoreplyScope = 'private';
                configManager.save();
                await channelSender(message, client, "Auto-reply scope set to: private", 1);
                return;
            }
            await channelSender(message, client, "Invalid scope. Use: scope private|groups|all", 2);
            return;
        }

        await channelSender(message, client, "Usage: .setautoreply on|off OR .setautoreply scope private|groups|all", 2);

    } catch (error) {
        console.error("_Error changing the autoreply setting:_", error);
    }
}

export async function setlike(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) return;

    try {

        if (args.join(' ').toLowerCase().includes("on")) {


            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].like = true;

            }

            configManager.save();

            await channelSender(message, client, "status like has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].like = false;

            }

            configManager.save();

            await channelSender(message, client, "status like has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 2); 
        }
    } catch (error) {

        console.error("_Error changing the like status:_", error);
    }
}

export async function setview(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) return;

    try {

        if (args.join(' ').toLowerCase().includes("on")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].view = true;

            }

            configManager.save();

            await channelSender(message, client, "status view has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].view = false;

            }

            configManager.save();

            await channelSender(message, client, "status view has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 2); 
        }
    } catch (error) {

        console.error("_Error changing the view status:_", error);
    }
}


export async function setonline(message, client) {

    const number = client.user.id.split(':')[0];

    const remoteJid = message.key.remoteJid;

    const messageBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    const commandAndArgs = messageBody.slice(1).trim();

    const parts = commandAndArgs.split(/\s+/);

    const args = parts.slice(1);

    if (!configManager.config?.users[number]) return;

    try {
                                                                   
        if (args.join(' ').toLowerCase().includes("on")) {


            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].online = true;

            }

            configManager.save();

            await channelSender(message, client, "online has been turn on", 1); 

        } else if (args.join(' ').toLowerCase().includes("off")) {

            if (configManager.config && configManager.config.users[number]) {
                     
                configManager.config.users[number].online = false;

            }

            configManager.save();

            await channelSender(message, client, "online has been turn off", 1); 

        } else {

            await channelSender(message, client, "Select an option on / off", 2); 
        }
    } catch (error) {

        console.error("_Error changing the online status:_", error);
    }
}




export default { setreaction, setprefix, setwelcome, setautorecord, setautotype, setlike, setview, setonline };