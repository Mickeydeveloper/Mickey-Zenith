// Telegram pairing and bot runner
import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '<YOUR_TELEGRAM_BOT_TOKEN>';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (/^\/pair/i.test(msg.text)) {
        // Pairing logic here
        bot.sendMessage(chatId, 'Your WhatsApp bot is now paired with Telegram!');
    } else {
        bot.sendMessage(chatId, 'Hello from Mickey-Zenith!');
    }
});

console.log('Telegram bot is running and ready to pair.');