
import configManager from '../utils/manageConfigs.js';

import channelSender from '../commands/channelSender.js'

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

        console.error("_Error changing the status like status:_", error);
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




export default { setreaction, setprefix, setwelcome, setautorecord, setautotype, setlike, setonline };