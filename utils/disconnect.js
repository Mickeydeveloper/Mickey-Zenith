
import configManager from '../utils/manageConfigs.js';

import fs from "fs";

import fsp from "fs/promises";

import sender from '../utils/sender.js';

const SESSIONS_FILE = "./sessions.json";

const sessions = {};


function removeSession(number, bot, msg) {

	const chatId = msg.chat.id;

    if (fs.existsSync(SESSIONS_FILE)) {

        let sessionsList = [];

        try {

            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE));

            sessionsList = Array.isArray(data.sessions) ? data.sessions : [];

        } catch (err) {

            sessionsList = [];

            return bot.sendMessage(chatId, `❌ Error reading sessions file: ${err}`, { parse_mode: "Markdown" });

            
        }

        sessionsList = sessionsList.filter(num => num !== number);

        fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: sessionsList }, null, 2));
    }

    const sessionPath = `./sessions/${number}`;

    if (fs.existsSync(sessionPath)) {

        fs.rmSync(sessionPath, { recursive: true, force: true });
    }


    delete sessions[number];

    console.log(`✅ Session for ${number} fully removed.`);


    return bot.sendMessage(chatId, "Session deleted sucessfully\n Thanks for using our service\n Hope you enjoyed.", { parse_mode: "Markdown" });
}

export async function disconnect(bot, msg, match) {

    const chatId = msg.chat.id;

    const text = match?.[1]?.trim();

    if (!text) {

        return bot.sendMessage(chatId, "❌ Please provide a phone number.\nUsage: `/disconnect <number>`", { parse_mode: "Markdown" });
    }

    const targetNumber = text.replace(/\D/g, "");

    console.log("Sanitized number:", targetNumber);


    return removeSession(targetNumber, bot, msg);

}

export default disconnect ;
