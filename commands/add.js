// This command allows any user to add members to a group.

const add = {
    name: 'add',
    description: 'Add members to a group',
    async execute(message, args, client) {
        const remoteJid = message.key.remoteJid;
        
        // Check if the command is used in a group
        if (!remoteJid.endsWith('@g.us')) {
            await client.sendMessage(remoteJid, { 
                text: 'This command can only be used in groups!' 
            });
            return;
        }

        // Check if there are numbers to add
        if (args.length === 0) {
            await client.sendMessage(remoteJid, { 
                text: 'Please provide the phone numbers to add!\nExample: .add 1234567890' 
            });
            return;
        }
        
        // Format the numbers to proper format (add @s.whatsapp.net)
        const membersToAdd = args.map(number => {
            // Remove any non-numeric characters
            number = number.replace(/[^0-9]/g, '');
            // Add the suffix if it's not there
            return number.endsWith('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
        });

        try {
            // Add participants to the group
            const response = await client.groupParticipantsUpdate(
                remoteJid,
                membersToAdd,
                "add"
            );
            
            await client.sendMessage(remoteJid, { 
                text: `Successfully added members: ${args.join(', ')}` 
            });
        } catch (error) {
            await client.sendMessage(remoteJid, { 
                text: 'Failed to add members. Make sure the numbers are valid and I have admin privileges.' 
            });
            console.error('Error in add command:', error);
        }
    }
};

export default add;