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
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

const LOCALES = {
  en: {
    title: 'Premium Menu',
    subtitle: 'Explore powerful commands • 24/7 Uptime',
    helpPrompt: 'Select a category to view commands',
    footer: 'Powered by Mickey Glitch',
    categories: {
      general: 'General',
      group: 'Group Management',
      settings: 'Bot Settings',
      media: 'Media & Stickers',
      ai: 'AI Powered',
      fun: 'Fun Effects',
      download: 'Downloader',
      meme: 'Meme Templates',
      anime: 'Anime Reactions'
    }
  },
  sw: {
    title: 'Menyu ya Premium',
    subtitle: 'Gundua amri zenye nguvu • 24/7',
    helpPrompt: 'Chagua kategoria ili uone amri',
    footer: 'Imetengenezwa na Mickey Glitch',
    categories: {
      general: 'Msingi',
      group: 'Usimamizi wa Kikundi',
      settings: 'Mipangilio ya Bot',
      media: 'Vyombo & Stickers',
      ai: 'AI',
      fun: 'Burudani',
      download: 'Download',
      meme: 'Meme Templates',
      anime: 'Athari za Anime'
    }
  }
};

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
module.exports = async (sock, chatId, message, args) => {
  try {
    const botName = settings.botName || 'Mickey Glitch';
    const banner = settings.bannerUrl || settings.menuBannerUrl || 'https://water-billimg.onrender.com/1761205727440.png';
    const sourceUrl = settings.homepage || settings.website || settings.updateZipUrl || 'https://github.com';

    // Buttons (use quickReplyButton template format for better client support)
    const buttons = [
      { quickReplyButton: { displayText: 'Owner', id: 'owner' } },
      { quickReplyButton: { displayText: 'Channel', id: 'channel' } },
      { quickReplyButton: { displayText: 'Support', id: 'support' } },
      { quickReplyButton: { displayText: 'Menu', id: '.menu' } }
    ];

    // Categories mapping (used for list menu and category details)
    const CATEGORIES = {
      general: ['menu','ping','alive','halotel','phone','tts','owner','lyrics','groupinfo','staff','url','fancy'],
      group: ['ban','promote','demote','mute','unmute','delete','kick','add','warn','antilink','antibadword','clear','tag','tagall','hidetag','resetlink','antitag','setgdesc','setgname','setgpp'],
      settings: ['mode','clearsession','antidelete','cleartmp','update','settings','setpp','autoreact','autostatus','autotyping','autoread','autoreply','anticall','pmblocker','setmention','mention'],
      media: ['sticker','simage','tgsticker','take','emojimix','blur','igs','igsc','video','play'],
      ai: ['gpt','gemini','imagine'],
      fun: ['compliment','character','wasted','stupid'],
      download: ['song','video','spotify','instagram','facebook','tiktok','ytmp4'],
      meme: ['heart','horny','circle','lgbt','namecard','oogway','tweet','ytcomment','comrade','glass','passed','triggered'],
      anime: ['neko','waifu','nom','poke','cry','kiss','pat','hug','wink','facepalm']
    };

    // Determine locale (allow settings.defaultLang, fallback to 'en')
    const lang = (settings.defaultLang || 'en').toLowerCase().startsWith('sw') ? 'sw' : 'en';
    const L = LOCALES[lang] || LOCALES.en;

    // If args provided (e.g., '.help media' or '.help 1'), show category detail
    const argText = (args || '').toString().trim();
    const categoryArg = (argText.split(' ')[1] || '').toLowerCase() || (argText.split(' ')[0] && argText.split(' ')[0] !== '.help' ? argText.split(' ')[0] : '');

    // Helper to pretty-format a category
    const formatCategory = (key) => {
      const commands = CATEGORIES[key] || [];
      if (!commands.length) return `${L.categories[key] || key}: (no commands)`;
      return `*${L.categories[key] || key}*\n\n` + commands.map(c => `• ${c}`).join('\n');
    };

    if (categoryArg) {
      // Map numeric selection (1..n) to category keys (stable order)
      const keys = Object.keys(CATEGORIES);
      let key = categoryArg;
      if (/^\d+$/.test(categoryArg)) {
        const idx = parseInt(categoryArg, 10) - 1;
        if (idx >= 0 && idx < keys.length) key = keys[idx];
      }
      // Normalize known synonyms
      key = key.replace(/^\./, '').trim();
      // If it's a name like 'media' or 'general', use it, else check for mapping
      if (!CATEGORIES[key]) {
        // try to match by category short name
        const found = keys.find(k => k.startsWith(key) || (L.categories[k] && L.categories[k].toLowerCase().includes(key)));
        if (found) key = found;
      }

      if (CATEGORIES[key]) {
        const text = `${L.title} • ${L.categories[key] || key}\n\n${formatCategory(key)}\n\n${L.footer}`;
        // Offer a Back button
        const { sendButtons } = require('../lib/myfunc');
        const navButtons = [
          { quickReplyButton: { displayText: 'Back', id: '.help' } },
          { quickReplyButton: { displayText: 'Main Menu', id: '.menu' } },
          { quickReplyButton: { displayText: 'Owner', id: 'owner' } }
        ];
        await sendButtons(sock, chatId, text, L.footer, navButtons, message);
        return;
      }
    }

    // Otherwise send a professional single-select list of categories
    const sections = [
      {
        title: L.helpPrompt,
        rows: Object.keys(CATEGORIES).map((k, i) => ({
          title: `${i + 1}. ${L.categories[k] || k}`,
          rowId: `.help ${k}`,
          description: `View ${L.categories[k] || k} commands`
        }))
      }
    ];

    const { sendList, sendButtons } = require('../lib/myfunc');

    // Quick action footer buttons
    const quick = [
      { quickReplyButton: { displayText: 'Owner', id: 'owner' } },
      { quickReplyButton: { displayText: 'Support', id: 'support' } },
      { quickReplyButton: { displayText: 'Language: EN', id: '.help en' } }
    ];

    // Try list first (best UX), fallback to buttons
    try {
      await sendList(sock, chatId, `${L.title} — ${botName}\n\n${L.subtitle}\n\nUptime: ${getUptime()}`, L.footer, `${botName} • ${L.title}`, 'Choose category', sections, message, {
        contextInfo: {
          externalAdReply: {
            title: `${botName} • ${L.title}`,
            body: L.subtitle,
            thumbnailUrl: banner,
            sourceUrl: sourceUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      });

      // Also send quick buttons as companion (some clients show list but not template buttons)
      await sendButtons(sock, chatId, 'Quick actions:', L.footer, quick, message);
    } catch (err) {
      // Fallback to buttons-only presentation
      console.error('Help list send failed, falling back to buttons:', err);
      await sendButtons(sock, chatId, `${L.title} — ${botName}\n\n${L.subtitle}\n\nUptime: ${getUptime()}`, L.footer, quick, message, {
        contextInfo: {
          externalAdReply: {
            title: `${botName} • ${L.title}`,
            body: L.subtitle,
            thumbnailUrl: banner,
            sourceUrl: sourceUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      });
    }
  } catch (err) {
    console.error("Help menu error:", err);
    await sock.sendMessage(chatId, { 
      text: "⚠️ Failed to load help menu. Please try again later." 
    }, { quoted: message });
  }
};