
import configManager from '../utils/manageConfigs.js';

import channelSender from '../commands/channelSender.js'

export async function auto(message, client, cond, emoji="🥷"){

    const remoteJid = message.key.remoteJid;

    if(cond){

        await client.sendMessage(remoteJid, 

            {
                react: {
                    text: `${emoji}`,

                    key: message.key
                }
            }
    )

    } else {

        return
    }
}

// Simple emoji regex (works for most cases)
function isEmoji(str) {

    const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;

    return emojiRegex.test(str);
}

export async function autoreact(message, client) {

    const number = client.user.id.split(':')[0];

    try {

        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) {

            throw new Error("Message JID is undefined.");
        }

        const messageBody =

            message.message?.extendedTextMessage?.text ||

            message.message?.conversation ||

            '';

        const commandAndArgs = messageBody.slice(1).trim();

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1);

        if (args.length === 0) {

            throw new Error("Please provide 'on', 'off'.");
        }

        const input = args[0].toLowerCase();

        if (!configManager.config.users[number]) {

            configManager.config.users[number] = {};
        }

        const userConfig = configManager.config.users[number];

        if (input === 'on') {

            userConfig.autoreact = true;

            configManager.save();

            await channelSender(

                message,

                client,

                `Auto-react has been turned *${input.toUpperCase()}*.`,
                3
            );
        
        } else if (input === "off"){

             userConfig.autoreact = false;

            configManager.save();

            await channelSender(

                message,

                client,

                `Auto-react has been turned *${input.toUpperCase()}*.`,
                3
            );

        } else{

            await client.sendMessage(remoteJid, { text: "_*Select an option: On/off*_" });
        }

    } catch (error) {

        await client.sendMessage(message.key.remoteJid, {

            text: `❌ Error while updating autoreact settings: ${error.message}`,
        });
    }
}

export default { auto, autoreact };