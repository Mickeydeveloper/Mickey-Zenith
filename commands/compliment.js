const compliments = [
    "Wewe ni wa ajabu jinsi ulivyo!",
    "Una hisia nzuri ya ucheshi!",
    "Wewe ni mtu mwenye huruma na mkarimu.",
    "Una nguvu zaidi ya unavyofikiri.",
    "Unamulika chumba!",
    "Wewe ni rafiki wa kweli.",
    "Unanihamasisha!",
    "Ubunifu wako hauwezi kupimika!",
    "Moyo wako ni wa dhahabu.",
    "Unafanya tofauti kwa ulimwengu.",
    "Mwangaza wako wa furaha unasambaa!",
    "Una nidhamu kubwa kazini.",
    "Unachochea wengine kufanya vizuri.",
    "Tabasamu lako linaangaza siku ya kila mtu.",
    "Una vipaji vingi katika kila unachofanya.",
    "Wema wako hufanya dunia kuwa bora.",
    "Una mtazamo wa kipekee na mzuri.",
    "Shauku yako ni ya kuhamasisha!",
    "Una uwezo wa kufikia mambo makubwa.",
    "Mara zote unajua jinsi ya kumfanya mtu ajisikie maalum.",
    "Ujasiri wako unastahili pongezi.",
    "Roho yako ni nzuri.",
    "Ukarimu wako hauna mipaka.",
    "Una macho mazuri kwa undani.",
    "Shauku yako inachochea wengine!",
    "Wewe ni msikilizaji mzuri.",
    "Wewe ni imara kuliko unavyofikiria!",
    "Kicheko chako kinaambukiza furaha.",
    "Una kipaji asili cha kuwafanya wengine wajihisi kuthaminiwa.",
    "Unafanya dunia kuwa mahali bora kwa kuwepo kwako."
];

async function complimentCommand(sock, chatId, message) {
    try {
        if (!message || !chatId) {
            console.log('Invalid message or chatId:', { message, chatId });
            return;
        }

        let userToCompliment;
        
        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToCompliment = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToCompliment = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToCompliment) {
            await sock.sendMessage(chatId, { 
                text: 'Tafadhali taja mtu au jibu ujumbe wao ili uweze kumpa sifa!'
            });
            return;
        }

        const compliment = compliments[Math.floor(Math.random() * compliments.length)];

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        await sock.sendMessage(chatId, { 
                text: `Habari @${userToCompliment.split('@')[0]}! ${compliment}`,
            mentions: [userToCompliment]
        });
    } catch (error) {
        console.error('Error in compliment command:', error);
            if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: 'Tafadhali jaribu tena baada ya sekunde chache.'
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: 'Kosa limetokea wakati wa kutuma sifa. Jaribu tena baadaye.'
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = { complimentCommand };
