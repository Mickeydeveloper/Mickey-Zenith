// This command allows any user to add members to a group.

const { Group } = require('bailey');

module.exports = {
    name: 'add',
    description: 'Add members to a group',
    async execute(message, args) {
        const groupId = message.groupId;
        const membersToAdd = args;

        try {
            await Group.addMembers(groupId, membersToAdd);
            message.reply(`Successfully added members: ${membersToAdd.join(', ')}`);
        } catch (error) {
            message.reply('Failed to add members.');
            console.error(error);
        }
    }
};