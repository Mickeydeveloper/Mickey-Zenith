const axios = require("axios");
const settings = require('../settings');
const fs = require('fs');
const path = require('path');

/**
 * Dynamic Uptime Formatter
 */
function getUptime() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return days > 0 ? `${days}d ${hours}h ${minutes}m \( {seconds}s` : ` \){hours}h ${minutes}m ${seconds}s`;
}

/**
 * Modern Premium Help Menu – One Command Per Line
 */
const HELP = `
           ✦ ✦ ✦ ${settings.botName || 'Mickey Glitch'} ✦ ✦ ✦
                  Premium Edition • Always Active

Bot Name   : ${settings.botName || 'Mickey Glitch'}
Owner      : ${settings.botOwner || 'Mozy24'} ${settings.ownerNumber ? '(+' + settings.ownerNumber + ')' : ''}
Version    : ${settings.version || '3.0.5'}
Uptime     : ${getUptime()}
Status     : ✅ Online & Fully Active

                   ✦ Command Categories ✦

General
• menu
• ping
• alive
• halotel
• phone
• tts
• owner
• attp
• lyrics
• groupinfo
• staff
• vv
• trt
• ss
• jid
• url
• fancy

Group Management
• ban
• promote
• demote
• mute
• unmute
• delete
• kick
• add
• warn
• antilink
• antibadword
• clear
• tag
• tagall
• hidetag
• chatbot
• resetlink
• antitag
• welcome
• goodbye
• setgdesc
• setgname
• setgpp

Bot Settings
• mode
• clearsession
• antidelete
• cleartmp
• update
• settings
• setpp
• autoreact
• autostatus
• autotying
• autoread
• anticall
• pmblocker
• setmention
• mention

Media & Stickers
• sticker
• simage
• tgsticker
• take
• emojimix
• blur
• igs
• igsc

AI Powered
• gpt
• gemini
• imagine

Fun Effects
• compliment
• character
• wasted
• stupid

Logo Makers
• metallic
• ice
• snow
• impressive
• matrix
• light
• neon
• devil
• purple
• thunder
• leaves
• 1917
• arena
• hacker
• sand
• blackpink
• glitch
• fire

Downloader
• play
• song
• video
• spotify
• instagram
• facebook
• tiktok
• ytmp4

Meme Templates
• heart
• horny
• circle
• lgbt
• lolice
• its-so-stupid
• namecard
• oogway
• tweet
• ytcomment
• comrade
• gay
• glass
• jail
• passed
• triggered

Anime Reactions
• neko
• waifu
• loli
• nom
• poke
• cry
• kiss
• pat
• hug
• wink
• facepalm

              ✨ Powered by Mickey Glitch ✨
`.trim();

/**
 * Send Modern Help Menu with Enhanced Visuals
 */
module.exports = async (sock, chatId, message) => {
  try {
    const botName = settings.botName || 'Mickey Glitch';
    const banner = settings.bannerUrl || settings.menuBannerUrl || 'https://water-billimg.onrender.com/1761205727440.png';
    const sourceUrl = settings.homepage || settings.website || settings.updateZipUrl || 'https://github.com';

    await sock.sendMessage(chatId, {
      text: HELP,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        externalAdReply: {
          title: `✦ ${botName} Premium Menu ✦`,
          body: 'Explore all powerful commands • 24/7 Uptime',
          thumbnailUrl: banner,
          sourceUrl: sourceUrl,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: message });

  } catch (err) {
    console.error("Help menu error:", err);
    await sock.sendMessage(chatId, { 
      text: "⚠️ Failed to load help menu. Please try again later." 
    }, { quoted: message });
  }
};

// Auto-discover commands (optimized)
module.exports.getAllCommands = function () {
  const commands = new Set();

  try {
    if (global.plugins && typeof global.plugins === 'object') {
      for (const key in global.plugins) {
        const plugin = global.plugins[key];
        if (plugin?.disabled) continue;

        const cmds = Array.isArray(plugin.command) ? plugin.command : (plugin.command ? [plugin.command] : []);
        cmds.forEach(c => typeof c === 'string' && commands.add(c.replace(/^\^?\/?\.?/, '').toLowerCase()));
      }
    }

    const dir = __dirname;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'help.js');

    files.forEach(file => {
      try {
        const filePath = path.join(dir, file);
        delete require.cache[require.resolve(filePath)];
        const mod = require(filePath);

        const cmds = Array.isArray(mod.command) ? mod.command : (mod.command ? [mod.command] : []);
        cmds.forEach(c => typeof c === 'string' && commands.add(c.replace(/^\^?\/?\.?/, '').toLowerCase()));

        commands.add(file.replace('.js', '').toLowerCase());
      } catch (e) {}
    });
  } catch (e) {
    console.error("Error discovering commands:", e);
  }

  return Array.from(commands).sort();
};