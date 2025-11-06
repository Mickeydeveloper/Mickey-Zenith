
import { REDIRECT_BOT } from '../config.js';

 
export async function redirect(bot,  msg) {

	if (redirect === 'None') {

		await bot.sendMessage(msg.chat.id, `Sorry all our bots are busy.\n\nPlease try again later or contact us direct through our group, to get premium acess at 2$ ( 1000 Fcfa )\nThanks for using our service.`);

	} else {

		await bot.sendMessage(msg.chat.id, `Oups sorry this bot is completely full\n kindly redirect yourself to our next free bot\n👉 ${REDIRECT_BOT}`)
	}
	
	
}

export default redirect;


