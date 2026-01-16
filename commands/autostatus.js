const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');



// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Default config: all features enabled by default
const DEFAULT_CONFIG = {
    enabled: true,        // Auto view status - ON by default
    reactOn: true,        // Auto react to status - ON by default
    forwardToBot: true    // Forward/save status to bot number - ON by default
};

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// Get bot's own JID
function getBotJid(sock) {
    try {
        return sock.user?.id || sock.user?.jid;
    } catch (error) {
        console.debug('Error getting bot JID:', error?.message);
        return null;
    }
}

// Function to forward/save status to bot's own number
async function forwardStatusToBot(sock, statusMessage) {
    try {
        if (!isForwardToBotEnabled()) {
            return;
        }

        const botJid = getBotJid(sock);
        if (!botJid) {
            console.debug('[AutoStatus] Cannot forward: bot JID not available');
            return;
        }

        // Extract status content from message
        const statusContent = statusMessage?.message || statusMessage || {};
        
        // Check if there's actual media to forward
        const hasMedia = statusContent.imageMessage || statusContent.videoMessage || statusContent.audioMessage || statusContent.textMessage;
        if (!hasMedia) {
            console.debug('[AutoStatus] No media in status, skipping forward');
            return;
        }
        
        // Prepare forwarded message - use relayMessage for status forwarding
        const messageBody = {
            ...statusContent,
            contextInfo: {
                ...(statusContent.contextInfo || {}),
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: 'status@broadcast',
                    newsletterName: 'Status Update',
                    serverMessageId: -1
                }
            }
        };

        // Send the message to bot's own chat
        await sock.sendMessage(botJid, messageBody);
        console.log('[AutoStatus] ✅ Status forwarded to bot successfully');
        
    } catch (error) {
        console.error('[AutoStatus] ❌ Forward to bot error:', error?.message);
    }
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!',
                ...channelInfo
            });
            return;
        }

        // Read current config
        let config = JSON.parse(fs.readFileSync(configPath));

        // If no arguments, show current status
        if (!args || args.length === 0) {
            const status = config.enabled ? '🟢 ON' : '🔴 OFF';
            const reactStatus = config.reactOn ? '🟢 ON' : '🔴 OFF';
            const forwardStatus = config.forwardToBot ? '🟢 ON' : '🔴 OFF';
            await sock.sendMessage(chatId, { 
                text: `🔄 *Auto Status Settings*\n\n📱 *Auto Status View:* ${status}\n💫 *Status Reactions:* ${reactStatus}\n📤 *Forward to Bot:* ${forwardStatus}\n\n*Commands:*\n.autostatus on - Enable auto status\n.autostatus off - Disable auto status\n.autostatus react on/off - Toggle reactions\n.autostatus forward on/off - Toggle forward to bot`
            });
            return;
        }

        // Handle on/off commands
        const command = args[0].toLowerCase();
        
        if (command === 'on') {
            config.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '✅ Auto status enabled!\n📱 View: ON\n💫 React: ' + (config.reactOn ? 'ON' : 'OFF') + '\n📤 Forward: ' + (config.forwardToBot ? 'ON' : 'OFF')
            });
        } else if (command === 'off') {
            config.enabled = false;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '❌ Auto status disabled!\nAll features turned off.'
            });
        } else if (command === 'react') {
            // Handle react subcommand
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Please specify on/off!\nUse: .autostatus react on/off'
                });
                return;
            }
            
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '✅ Status reactions enabled!\nBot will react to all status updates.'
                });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '❌ Status reactions disabled!'
                });
            } else {
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid! Use: .autostatus react on/off'
                });
            }
        } else if (command === 'forward') {
            // Handle forward subcommand
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Please specify on/off!\nUse: .autostatus forward on/off'
                });
                return;
            }
            
            const forwardCommand = args[1].toLowerCase();
            if (forwardCommand === 'on') {
                config.forwardToBot = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '✅ Status forward enabled!\nBot will save all status updates to itself.'
                });
            } else if (forwardCommand === 'off') {
                config.forwardToBot = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '❌ Status forward disabled!'
                });
            } else {
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid! Use: .autostatus forward on/off'
                });
            }
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid command!\n\n*Usage:*\n.autostatus - Show settings\n.autostatus on/off - Toggle all\n.autostatus react on/off - Toggle reactions\n.autostatus forward on/off - Toggle forward'
            });
        }

    } catch (error) {
        console.error('Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error: ' + error.message
        });
    }
}

// Load config with defaults
function loadConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
            return DEFAULT_CONFIG;
        }
        const config = JSON.parse(fs.readFileSync(configPath));
        // Merge with defaults to ensure all keys exist
        return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
        console.error('Error loading config:', error);
        return DEFAULT_CONFIG;
    }
}

// Check if auto status is enabled
function isAutoStatusEnabled() {
    const config = loadConfig();
    return config.enabled;
}

// Check if status reactions are enabled
function isStatusReactionEnabled() {
    const config = loadConfig();
    return config.reactOn;
}

// Check if forward to bot is enabled
function isForwardToBotEnabled() {
    const config = loadConfig();
    return config.forwardToBot;
}

// Function to react to status using proper method
async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled()) {
            return;
        }

        // Use the proper relayMessage method for status reactions
        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: '🤍'
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );
        
        // Removed success log - only keep errors
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) {
            return;
        }

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle status from messages.upsert
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                try {
                    await sock.readMessages([msg.key]);
                    const sender = msg.key.participant || msg.key.remoteJid;
                    
                    // React to status if enabled
                    if (isStatusReactionEnabled()) {
                        await reactToStatus(sock, msg.key);
                    }
                    
                    // Forward/save status to bot if enabled
                    if (isForwardToBotEnabled()) {
                        await forwardStatusToBot(sock, msg);
                    }
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        console.log('⚠️ Rate limit hit, waiting before retrying...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await sock.readMessages([msg.key]);
                    } else {
                        throw err;
                    }
                }
                return;
            }
        }

        // Handle direct status updates
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([status.key]);
                const sender = status.key.participant || status.key.remoteJid;
                
                // React to status if enabled
                if (isStatusReactionEnabled()) {
                    await reactToStatus(sock, status.key);
                }
                
                // Forward/save status to bot if enabled
                if (isForwardToBotEnabled()) {
                    await forwardStatusToBot(sock, status);
                }
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit, waiting before retrying...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await sock.readMessages([status.key]);
                } else {
                    throw err;
                }
            }
            return;
        }

        // Handle status in reactions
        if (status.reaction && status.reaction.key.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([status.reaction.key]);
                const sender = status.reaction.key.participant || status.reaction.key.remoteJid;
                
                // React to status if enabled
                if (isStatusReactionEnabled()) {
                    await reactToStatus(sock, status.reaction.key);
                }
                
                // Forward/save status to bot if enabled
                if (isForwardToBotEnabled()) {
                    await forwardStatusToBot(sock, status.reaction);
                }
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit, waiting before retrying...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await sock.readMessages([status.reaction.key]);
                } else {
                    throw err;
                }
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error in auto status view:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
}; 