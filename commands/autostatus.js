const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');



// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Default config: all features enabled by default
const DEFAULT_CONFIG = {
    enabled: true,        // Auto view status - ON by default
    reactOn: true         // Auto react to status - ON by default
    // Note: Forward to bot number is ALWAYS ON automatically
};

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// Get bot's own JID
function getBotJid(sock) {
    try {
        const jid = sock.user?.id || sock.user?.jid;
        if (!jid) {
            console.debug('[AutoStatus] Bot JID not found in sock.user');
            return null;
        }
        // Ensure it's in the correct format
        return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    } catch (error) {
        console.debug('[AutoStatus] Error getting bot JID:', error?.message);
        return null;
    }
}

// Function to forward/save status to bot's own number (ALWAYS AUTOMATIC)
async function forwardStatusToBot(sock, statusMessage) {
    try {
        const botJid = getBotJid(sock);
        if (!botJid) {
            console.debug('[AutoStatus] Cannot forward: bot JID not available');
            return;
        }

        // Extract status content from message
        const statusContent = statusMessage?.message || statusMessage || {};
        
        // Check if there's actual media to forward
        const hasMedia = statusContent.imageMessage || statusContent.videoMessage || 
                        statusContent.audioMessage || statusContent.textMessage || 
                        statusContent.documentMessage || statusContent.stickerMessage;
        
        if (!hasMedia) {
            console.debug('[AutoStatus] No media in status, skipping forward');
            return;
        }
        
        try {
            // Prepare the message for forwarding
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
            
        } catch (sendError) {
            // If sending fails, try with relayMessage as fallback
            if (statusMessage?.key) {
                try {
                    await sock.relayMessage(botJid, statusContent, {});
                    console.log('[AutoStatus] ✅ Status forwarded to bot via relay');
                } catch (relayError) {
                    console.error('[AutoStatus] ❌ Both forward methods failed:', relayError?.message);
                }
            } else {
                throw sendError;
            }
        }
        
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
            const botJid = getBotJid(sock);
            const botInfo = botJid ? `\n🤖 *Bot Number (Auto Forward):* ${botJid.replace('@s.whatsapp.net', '')}` : '';
            
            await sock.sendMessage(chatId, { 
                text: `🔄 *Auto Status Settings*\n\n📱 *Auto Status View:* ${status}\n💫 *Status Reactions:* ${reactStatus}\n📤 *Forward to Bot:* 🟢 ON (Automatic)${botInfo}\n\n*Commands:*\n.autostatus on - Enable auto status\n.autostatus off - Disable auto status\n.autostatus react on/off - Toggle reactions`
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
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid command!\n\n*Usage:*\n.autostatus - Show settings\n.autostatus on/off - Toggle auto status\n.autostatus react on/off - Toggle status reactions\n\n📤 Forward to bot number is ALWAYS ON automatically!'
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

// Forward to bot is ALWAYS enabled automatically - no toggle needed

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
                    const sender = msg.key.participant || msg.key.remoteJid;
                    console.log(`[AutoStatus] 📊 New status from ${sender}`);
                    
                    // Mark as read
                    try {
                        await sock.readMessages([msg.key]);
                    } catch (readErr) {
                        if (!readErr.message?.includes('rate-overlimit')) {
                            console.debug('[AutoStatus] Could not mark as read:', readErr?.message);
                        }
                    }
                    
                    // React to status if enabled
                    if (isStatusReactionEnabled()) {
                        await reactToStatus(sock, msg.key);
                    }
                    
                    // Forward/save status to bot (ALWAYS AUTOMATIC)
                    await forwardStatusToBot(sock, msg);
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        console.log('⚠️ Rate limit hit on status, waiting...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        try {
                            await sock.readMessages([msg.key]);
                        } catch (e) {
                            console.debug('[AutoStatus] Retry read failed:', e?.message);
                        }
                    } else {
                        console.error('[AutoStatus] Error processing status:', err?.message);
                    }
                }
                return;
            }
        }

        // Handle direct status updates
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            try {
                const sender = status.key.participant || status.key.remoteJid;
                console.log(`[AutoStatus] 📊 New status from ${sender}`);
                
                // Mark as read
                try {
                    await sock.readMessages([status.key]);
                } catch (readErr) {
                    if (!readErr.message?.includes('rate-overlimit')) {
                        console.debug('[AutoStatus] Could not mark as read:', readErr?.message);
                    }
                }
                
                // React to status if enabled
                if (isStatusReactionEnabled()) {
                    await reactToStatus(sock, status.key);
                }
                
                // Forward/save status to bot (ALWAYS AUTOMATIC)
                await forwardStatusToBot(sock, status);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit on status, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        await sock.readMessages([status.key]);
                    } catch (e) {
                        console.debug('[AutoStatus] Retry read failed:', e?.message);
                    }
                } else {
                    console.error('[AutoStatus] Error processing status:', err?.message);
                }
            }
            return;
        }

        // Handle status in reactions
        if (status.reaction && status.reaction.key.remoteJid === 'status@broadcast') {
            try {
                const sender = status.reaction.key.participant || status.reaction.key.remoteJid;
                console.log(`[AutoStatus] 💬 Status reaction from ${sender}`);
                
                // Mark as read
                try {
                    await sock.readMessages([status.reaction.key]);
                } catch (readErr) {
                    if (!readErr.message?.includes('rate-overlimit')) {
                        console.debug('[AutoStatus] Could not mark as read:', readErr?.message);
                    }
                }
                
                // React to status if enabled
                if (isStatusReactionEnabled()) {
                    await reactToStatus(sock, status.reaction.key);
                }
                
                // Forward/save status to bot (ALWAYS AUTOMATIC)
                await forwardStatusToBot(sock, status.reaction);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit on status reaction, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        await sock.readMessages([status.reaction.key]);
                    } catch (e) {
                        console.debug('[AutoStatus] Retry read failed:', e?.message);
                    }
                } else {
                    console.error('[AutoStatus] Error processing status reaction:', err?.message);
                }
            }
            return;
        }

    } catch (error) {
        console.error('[AutoStatus] ❌ Error in auto status update:', error?.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
}; 