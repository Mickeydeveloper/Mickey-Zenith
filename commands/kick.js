const isAdmin = require('../lib/isAdmin');

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe;
    const text = message.message?.extendedTextMessage?.text ||
                 message.message?.conversation || '';

    // Check if the command is "kick all"
    const isKickAll = /kick\s+all/i.test(text);

    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
            return;
        }

        if (!isSenderAdmin && !isKickAll) {
            await sock.sendMessage(chatId, { text: 'Only group admins can use the kick command.' }, { quoted: message });
            return;
        }

        // For "kick all", still require sender to be admin (owner bypasses this)
        if (isKickAll && !isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'Only group admins can use "kick all".' }, { quoted: message });
            return;
        }
    }

    // Fetch group metadata once
    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants || [];

    // Get bot JID in various formats for protection
    const botId = sock.user?.id || '';
    const botLid = sock.user?.lid || '';
    const botPhoneNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
    const botIdFormatted = botPhoneNumber + '@s.whatsapp.net';
    const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);

    let usersToKick = [];

    if (isKickAll) {
        // Kick all non-admin members (exclude admins and bot)
        usersToKick = participants
            .filter(p => !p.admin) // not admin or superadmin
            .map(p => p.id)
            .filter(jid => {
                // Extra safety: don't kick the bot itself
                const phone = jid.includes('@') ? jid.split('@')[0] : jid;
                const lidNumeric = jid.includes('@lid') ? jid.split('@')[0].split(':')[0] : '';
                return !(
                    jid === botId ||
                    jid === botLid ||
                    jid === botIdFormatted ||
                    phone === botPhoneNumber ||
                    (lidNumeric && lidNumeric === botLidNumeric)
                );
            });

        if (usersToKick.length === 0) {
            await sock.sendMessage(chatId, { text: 'No members to kick (only admins or bot present).' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `Kicking ${usersToKick.length} member(s)... Please wait.`
        }, { quoted: message });
    } else {
        // Regular kick behavior (mention or reply)
        if (mentionedJids && mentionedJids.length > 0) {
            usersToKick = mentionedJids;
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            usersToKick = [message.message.extendedTextMessage.contextInfo.participant];
        }

        if (usersToKick.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'Please mention the user or reply to their message to kick!'
            }, { quoted: message });
            return;
        }
    }

    // Prevent kicking the bot (final safety check)
    const isTryingToKickBot = usersToKick.some(userId => {
        const userPhoneNumber = userId.includes(':') ? userId.split(':')[0] : (userId.includes('@') ? userId.split('@')[0] : userId);
        const userLidNumeric = userId.includes('@lid') ? userId.split('@')[0].split(':')[0] : '';

        return (
            userId === botId ||
            userId === botLid ||
            userId === botIdFormatted ||
            userPhoneNumber === botPhoneNumber ||
            (userLidNumeric && botLidNumeric && userLidNumeric === botLidNumeric)
        );
    });

    if (isTryingToKickBot) {
        await sock.sendMessage(chatId, { 
            text: "I can't kick myself🤖"
        }, { quoted: message });
        return;
    }

    try {
        // WhatsApp may rate-limit or fail on very large groups; we proceed anyway
        await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");

        if (isKickAll) {
            await sock.sendMessage(chatId, { 
                text: `Successfully kicked ${usersToKick.length} member(s)! Group cleaned.`
            });
        } else {
            const usernames = usersToKick.map(jid => `@${jid.split('@')[0]}`);
            await sock.sendMessage(chatId, { 
                text: `${usernames.join(', ')} has been kicked successfully!`,
                mentions: usersToKick
            });
        }
    } catch (error) {
        console.error('Error in kick command:', error);
        await sock.sendMessage(chatId, { 
            text: isKickAll 
                ? 'Failed to kick all members. Some may remain due to WhatsApp limits or errors.'
                : 'Failed to kick user(s)!'
        }, { quoted: message });
    }
}

module.exports = kickCommand;