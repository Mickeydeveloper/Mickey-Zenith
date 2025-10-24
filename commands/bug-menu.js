// ✅ Import required modules
import configManager from '../utils/manageConfigs.js';
import { BOT_NAME, OWNER_NAME } from '../config.js';

// ✅ Define the bugMenu function
export async function bugMenu(message, client) {
    try {
        const remoteJid = message.key.remoteJid;
        const today = new Date();

        // 📅 Date and time details
        const daysOfWeek = [
            "Sunday", "Monday", "Tuesday", "Wednesday",
            "Thursday", "Friday", "Saturday"
        ];

        const currentDay = daysOfWeek[today.getDay()];
        const currentDate = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 👤 User and client info
        const number = client.user.id.split(':')[0];
        const username = message.pushName || "Unknown User";
        const prefix = configManager?.config?.users?.[number]?.prefix || ".";

        // 🧾 Message content
        const menuText = `
╭────────────────╮
    ༒ ${BOT_NAME} ༒
╰────────────────╯
╭────────────────╮
│ Prefix : ${prefix}
│ Hello, ${username}  
│ Day : ${currentDay}
│ Date : ${currentDate}/${currentMonth}/${currentYear}
│ Version : 5.2.0
│ Plugins : 63
│ Type : X-MD
╰────────────────╯

╭──[ 🕷 BUGS 🕷 ]────╮
│
│ ⇛ s-group <in group>
│ ⇛ s-kill 237xxxxx
│ ⇛ s-crash 237xxxxx
│ ⇛ s-delay 237xxxxx
│ ⇛ s-freeze 237xxxxx
│ ⇛ s-crashinvisi 237xxxxx
│ ⇛ s-crashios 237xxxxx
╰────────────────╯       

> Powered By ${OWNER_NAME} Tech 
📩 Contact: mickidadyhamza@gmail.com
`;

        // 🖼️ Send image with caption
        await client.sendMessage(remoteJid, {
            image: {
                url: "https://water-billimg.onrender.com/1761205727440.jpg"
            },
            caption: menuText,
        });

    } catch (error) {
        console.error("❌ Error in bugMenu:", error);
        if (message?.key?.remoteJid && client) {
            await client.sendMessage(message.key.remoteJid, {
                text: "❌ An error occurred while sending the bug menu."
            });
        }
    }
}

// ✅ Export as default
export default bugMenu;
