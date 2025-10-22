import { OWNER_NUM } from '../config.js'
import { OWNER_NAME } from '../config.js'

// Array of hacking-themed jokes
const HACK_JOKES = [
    "🚀 *HACKING STEP 1:* Accessing device... *BYPASSING FIREWALL* 🤖\n\n💬 **Joke:** Why did the hacker go broke? He couldn't *byte* his tongue! 😂",
    
    "🔓 *HACKING STEP 2:* Injecting payload... *CRACKING ENCRYPTION* ⚡\n\n💬 **Joke:** What's a hacker's favorite exercise? *Running* from the cops! 🏃‍♂️💨",
    
    "📡 *HACKING STEP 3:* Establishing connection... *REMOTE ACCESS GRANTED* 🌐\n\n💬 **Joke:** Why don't hackers play hide and seek? Good luck *hiding* from them! 😈",
    
    "💾 *HACKING STEP 4:* Dumping memory... *SYSTEM COMPROMISED* 🖥️\n\n💬 **Joke:** What do you call a sleeping hacker? A *byte* on the side! 😴",
    
    "🎯 *HACKING STEP 5:* Full control achieved... *DEVICE HACKED SUCCESSFULLY* ✅\n\n💬 **Joke:** Why was the computer cold? It left its *Windows* open! 🥶",
    
    "🔥 *HACKING STEP 6:* Data exfiltration... *MISSION ACCOMPLISHED* 🏆\n\n💬 **Joke:** How do hackers get dates? They use *Tinder* matches! 💘",
    
    "⚙️ *HACKING STEP 7:* Installing backdoor... *PERSISTENT ACCESS* 🔄\n\n💬 **Joke:** Why did the hacker bring a ladder? To reach the *high-level* exploits! 🪜"
];

export async function sendHackJokes(message, client) {
    const remoteJid = message.key.remoteJid;
    
    // Send jokes in sequence with 2-second delays to simulate hacking steps
    for (let i = 0; i < HACK_JOKES.length; i++) {
        await client.sendMessage(remoteJid, { 
            text: HACK_JOKES[i] 
        });
        
        // Delay between each step (except the last one)
        if (i < HACK_JOKES.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Final hacked confirmation
    await client.sendMessage(remoteJid, { 
        text: `🎉 *HACK COMPLETED!* 🎉\n\n👤 **Hacker:** ${OWNER_NAME}\n📱 **Device:** ${OWNER_NUM}\n\n*Your device is now under my control!* 😎\n\n*Just kidding... Stay safe! 🔒*`
    });
}

// Alternative: Send single random hack joke
export async function sendRandomHackJoke(message, client) {
    const remoteJid = message.key.remoteJid;
    const randomJoke = HACK_JOKES[Math.floor(Math.random() * HACK_JOKES.length)];
    
    await client.sendMessage(remoteJid, { 
        text: randomJoke 
    });
}

// Main export - use sendHackJokes for full sequence, sendRandomHackJoke for single
export async function owner(message, client) {
    // Uncomment the line you want to use:
    await sendHackJokes(message, client);        // Full hacking sequence
    // await sendRandomHackJoke(message, client); // Single random joke
}

export default owner;
