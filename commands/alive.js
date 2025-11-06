import pkg from 'bailey';
const { downloadMediaMessage } = pkg;

export async function alive(message, client) {
    const remoteJid = message.key?.remoteJid;
    if (!remoteJid) return;

    try {
        // Video URL - replace with your desired video URL
        const videoUrl = "https://files.catbox.moe/gk56we.mp4"; // Example URL, replace with your video
        
        // Formatted caption with emojis and styling
        const caption = `*꧁༒☬ MICKEY-ZENITH ☬༒꧂*

⚡ *Status:* Online & Running
🤖 *Bot Version:* 5.2.0
🚀 *Response Time:* ${Date.now() - message.messageTimestamp * 1000}ms
🛡️ *Prefix:* 



_Bot is Active and Ready to Use_`;

        // Send the video with caption
        await client.sendMessage(remoteJid, {
            video: { url: videoUrl },
            caption: caption,
            gifPlayback: false // Set to true if you want it to play as GIF
        });

    } catch (error) {
        console.error("Error in alive command:", error);
        await client.sendMessage(remoteJid, { 
            text: "❌ Error executing alive command. Please try again later." 
        });
    }
}

export default alive;