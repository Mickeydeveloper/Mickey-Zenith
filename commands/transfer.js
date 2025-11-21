import { isJidGroup } from 'baileys';

/**
 * Transfer group members from current group to target group
 * Usage: .transfer <target_group_id>
 * The bot will add all members from the source group to the target group automatically
 */
export async function transfer(message, client) {
    const remoteJid = message.key.remoteJid;

    try {
        // Check if command is used in a group
        if (!isJidGroup(remoteJid)) {
            await client.sendMessage(remoteJid, { text: '_This command can only be used in groups._' });
            return;
        }

        // Parse command arguments to get target group ID
        const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
        const parts = messageBody.split(/\s+/);
        
        if (parts.length < 2) {
            await client.sendMessage(remoteJid, { 
                text: '_Usage: .transfer <target_group_id>\nExample: .transfer 120363123456789-1234567890@g.us_' 
            });
            return;
        }

        let targetGroupId = parts[1].trim();

        // Ensure target group ID has proper format
        if (!targetGroupId.includes('@g.us')) {
            targetGroupId = targetGroupId + '@g.us';
        }

        // Verify target group exists and bot is member
        let targetGroupMetadata;
        try {
            targetGroupMetadata = await client.groupMetadata(targetGroupId);
        } catch (err) {
            await client.sendMessage(remoteJid, { 
                text: `_Error: Cannot access target group. Make sure bot is a member of the target group._` 
            });
            return;
        }

        // Get source group metadata
        const sourceGroupMetadata = await client.groupMetadata(remoteJid);
        const sourceMembers = sourceGroupMetadata.participants;

        if (!sourceMembers || sourceMembers.length === 0) {
            await client.sendMessage(remoteJid, { text: '_No members found in source group._' });
            return;
        }

        // Extract phone numbers and format them like add.js does
        const botNumber = client.user.id.split(':')[0];
        
        const membersToTransfer = sourceMembers
            .filter(member => {
                // Exclude bot itself
                const memberId = member.id.split('@')[0];
                return memberId !== botNumber;
            })
            .map(member => {
                // Extract phone number and remove non-numeric characters
                const phoneNumber = member.id.split('@')[0];
                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                // Format exactly like add.js does
                return `${cleanNumber}@s.whatsapp.net`;
            });

        if (membersToTransfer.length === 0) {
            await client.sendMessage(remoteJid, { text: '_No members to transfer._' });
            return;
        }

        // Send starting message
        await client.sendMessage(remoteJid, { 
            text: `_Starting transfer of ${membersToTransfer.length} member(s) to target group..._` 
        });

        try {
            // Try to add all members at once like add.js does
            const response = await client.groupParticipantsUpdate(
                targetGroupId,
                membersToTransfer,
                "add"
            );
            
            await client.sendMessage(remoteJid, { 
                text: `_✅ Successfully transferred all ${membersToTransfer.length} members!_` 
            });

            // Notify target group
            await client.sendMessage(targetGroupId, { 
                text: `_${membersToTransfer.length} new member(s) have been added to this group._` 
            });

        } catch (error) {
            console.error('Error in transfer command:', error);
            await client.sendMessage(remoteJid, { 
                text: `_Failed to transfer members. Make sure bot is admin and numbers are valid.\nError: ${error.message}_` 
            });
        }

    } catch (error) {
        console.error('Error in transfer command:', error);
        await client.sendMessage(remoteJid, { 
            text: `_Error: Unable to transfer members. ${error.message}_` 
        });
    }
}

export default { transfer };
