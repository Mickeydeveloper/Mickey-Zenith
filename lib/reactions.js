const fs = require('fs');
const path = require('path');

// Default emojis for command reactions
const commandEmojis = ['⚡', '✨', '👍', '🎯', '🔔', '✅'];

// Map specific commands to emojis for clearer context-aware reactions
const commandEmojiMap = {
    'ping': '⚡',
    'help': '📋',
    'menu': '📋',
    'play': '🎵',
    'spotify': '🎵',
    'sticker': '🖼️',
    'meme': '😂',
    'joke': '🤣',
    'ban': '🛡️',
    'kick': '🦵',
    'promote': '⬆️',
    'demote': '⬇️',
    'alive': '🟢',
    'update': '🔄'
};

// Path for storing auto-reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Load auto-reaction state from file (default: enabled)
function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
            // If not explicitly set, default to true
            return typeof data.autoReaction === 'boolean' ? data.autoReaction : true;
        }
    } catch (error) {
        console.error('Error loading auto-reaction state:', error);
    }
    return true; // default enabled
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA) 
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA))
            : { groups: [], chatbot: {} };
        
        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving auto-reaction state:', error);
    }
}

// Store auto-reaction state
let isAutoReactionEnabled = loadAutoReactionState();

function getRandomEmoji() {
    return commandEmojis[Math.floor(Math.random() * commandEmojis.length)];
}

// Function to add reaction to a command message
async function addCommandReaction(sock, message) {
    try {
        if (!isAutoReactionEnabled || !message?.key?.id) return;

        // Try to determine command name from message content
        let text = '';
        try {
            text = (
                message.message?.conversation ||
                message.message?.extendedTextMessage?.text ||
                message.message?.imageMessage?.caption ||
                message.message?.videoMessage?.caption ||
                ''
            ).toString().trim();
        } catch (e) {
            text = '';
        }

        let cmd = '';
        if (text) {
            // Extract first token and strip leading dot or non-alphanum
            cmd = text.split(' ')[0].replace(/^\.+/, '').replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase();
        }

        // Choose emoji by command map, else random
        const emoji = commandEmojiMap[cmd] || getRandomEmoji();

        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });

        // Also send a small mention message showing who sent the command and the emoji
        try {
            const sender = message.key.participant || message.key.remoteJid;
            if (sender) {
                const mentionText = `${emoji} @${sender.split('@')[0]}`;
                await sock.sendMessage(message.key.remoteJid, {
                    text: mentionText,
                    mentions: [sender]
                });
            }
        } catch (notifyErr) {
            // Do not fail the main flow if notify message fails
            console.error('Error sending command mention notification:', notifyErr?.message || notifyErr);
        }
    } catch (error) {
        console.error('Error adding command reaction:', error);
    }
}

// Function to handle areact command
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        const args = message.message?.conversation?.split(' ') || [];
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been enabled globally',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been disabled globally',
                quoted: message
            });
        } else {
            const currentState = isAutoReactionEnabled ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { 
                text: `Auto-reactions are currently ${currentState} globally.\n\nUse:\n.areact on - Enable auto-reactions\n.areact off - Disable auto-reactions`,
                quoted: message
            });
        }
    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error controlling auto-reactions',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
}; 