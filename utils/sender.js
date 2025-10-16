 
export async function sender(bot,  msg, text) {
	
	await bot.sendMessage(msg.chat.id, `${text}`);
}

export default sender;
