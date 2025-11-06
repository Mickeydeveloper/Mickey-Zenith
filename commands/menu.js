import { BOT_NAME, OWNER_NAME } from '../config.js';

export async function menu(bot, msg) {
    try {
        const chatId = msg?.chat?.id;
        const userId = msg?.from?.id;
        const firstName = msg?.from?.first_name || "User";

        if (!chatId) {
            console.error("Chat ID is missing. Cannot send menu.");
            return;
        }

        const today = new Date();
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const messageText = ` 
╭─────────────────╮
      ༒ ${BOT_NAME} ༒
╰─────────────────╯
╭─────────────────╮
│ Hello, ${firstName} 
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear} 
│ Version : 1.6.0
│ Plugins : 6  
╰─────────────────╯

╭─[ ✧ BOT CMD ✧ ]──╮
│      
│ ⬢ /start    
│ ⬢ /menu          
│ ⬢ /connect 237xxxxx     
│ ⬢ /disconnect 237xxxxx   
╰─────────────────╯   

╭─[ ✧ OWNER CMD ✧ ]──╮
│      
│ ⬢ /addprem id   
│ ⬢ /delprem id            
╰─────────────────╯      

Powered By ${OWNER_NAME} Tech 🥷🏾
`;

        await bot.sendMessage(chatId, { text: messageText });
    } catch (error) {
        console.error("Error sending menu:", error);
    }
}

export default menu;
