const isAdmin = require('../lib/isAdmin');

/**
 * Add command: Invite a member to the group by phone number
 * Usage: .add <phone_number>
 * Example: .add 255612130873
 */
async function addCommand(sock, chatId, senderId, text, message) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
            return;
        }

        // Check if sender is admin
        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only group admins can add members.' }, { quoted: message });
            return;
        }

        // Check if bot is admin
        if (!adminStatus.isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to add members.' }, { quoted: message });
            return;
        }

        // Extract phone number from text
        const phoneNumber = (text || '').trim();
        if (!phoneNumber) {
            await sock.sendMessage(chatId, { text: '❌ Usage: .add <phone_number>\n\n📝 Example: .add 255612130873' }, { quoted: message });
            return;
        }

        // Validate phone number format
        // Remove common separators and validate it's numeric
        const cleanNumber = phoneNumber.replace(/[\s\-\+\(\)]/g, '');
        if (!/^\d+$/.test(cleanNumber)) {
            await sock.sendMessage(chatId, { text: '❌ Invalid phone number format. Please provide a valid number.\n\n📝 Example: .add 255612130873' }, { quoted: message });
            return;
        }

        // Remove leading + if present, and ensure it has at least 10 digits
        let finalNumber = cleanNumber.startsWith('+') ? cleanNumber.slice(1) : cleanNumber;
        if (finalNumber.length < 10) {
            await sock.sendMessage(chatId, { text: '❌ Phone number too short. Please provide a valid number with country code.' }, { quoted: message });
            return;
        }

        // Construct the JID (WhatsApp ID format)
        const memberId = `${finalNumber}@s.whatsapp.net`;

        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        try {
            // Add the member to the group
            await sock.groupParticipantsUpdate(chatId, [memberId], 'add');
            
            // Notify success
            await sock.sendMessage(chatId, { 
                text: `✅ Successfully added +${finalNumber} to the group!` 
            }, { quoted: message });
        } catch (addError) {
            // Handle specific add errors
            const errorMsg = addError && addError.message ? addError.message.toLowerCase() : '';
            
            if (errorMsg.includes('already') || errorMsg.includes('member')) {
                await sock.sendMessage(chatId, { 
                    text: `⚠️ User +${finalNumber} is already a member of the group.` 
                }, { quoted: message });
            } else if (errorMsg.includes('invalid') || errorMsg.includes('not found')) {
                await sock.sendMessage(chatId, { 
                    text: `❌ Phone number +${finalNumber} is invalid or not registered on WhatsApp.` 
                }, { quoted: message });
            } else if (errorMsg.includes('permission')) {
                await sock.sendMessage(chatId, { 
                    text: `❌ Bot doesn't have permission to add members. Check group settings.` 
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `❌ Failed to add member: ${addError && addError.message ? addError.message : 'Unknown error'}` 
                }, { quoted: message });
            }
        }
    } catch (e) {
        console.error('addCommand error:', e && e.message ? e.message : e);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred while adding the member. Please try again.' 
            }, { quoted: message });
        } catch (err) {}
    }
}

module.exports = addCommand;
