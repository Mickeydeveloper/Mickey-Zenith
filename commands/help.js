const axios = require('axios');
const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// Small uptime helper (fixed formatting)
function getUptime() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return days > 0 ? `${days}d ${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m ${seconds}s`;
}

// Internationalized short strings (English + Swahili)
const I18N = {
  en: {
    header: (botName) => `✦ ${botName} • Help Center ✦`,
    intro: (botName) => `Welcome to *${botName}* — reply with a number to browse categories.
Reply with a command name (e.g., ".play") to view usage.
Uptime: ${getUptime()}`,
    replyInstructions: `Reply with a number to open a category, or reply with 'next' / 'prev' to navigate pages, or reply with the command name for details.`,
    footer: (top) => `Powered by ${top}`,
    noCommands: 'No commands found in this category.',
    commandDetail: 'Command details',
    notFound: 'Command not found.'
  },
  sw: {
    header: (botName) => `✦ ${botName} • Kituo cha Msaada ✦`,
    intro: (botName) => `Karibu *${botName}* — jibu na nambari kuchunguza makundi.
Jibu na jina la amri (mfano ".play") kuona matumizi.
Muda wa kazi: ${getUptime()}`,
    replyInstructions: `Jibu na nambari kufungua kundi, au 'next' / 'prev' kuendelea, au jibu na jina la amri kwa maelezo.`,
    footer: (top) => `Inaandaliwa na ${top}`,
    noCommands: 'Hakuna amri katika kundi hili.',
    commandDetail: 'Maelezo ya amri',
    notFound: 'Amri haikupatikana.'
  }
};

// Command category mapping (best-effort)
const CATEGORY_MAP = {
  'General': ['menu','ping','alive','owner','settings','help','status','jid','url','phone','ss','trt','vv'],
  'Group Management': ['ban','promote','demote','mute','unmute','kick','add','warn','antilink','antibadword','clear','tag','tagall','hidetag','resetlink','antitag','welcome','goodbye','setgdesc','setgname','setgpp'],
  'Bot Settings': ['mode','clearsession','antidelete','cleartmp','update','setpp','autoreact','autostatus','autotyping','autoread','autoreply','anticall','pmblocker','autobio'],
  'Media & Stickers': ['sticker','simage','tgsticker','take','emojimix','blur','igs','igsc','stickertelegram'],
  'AI Powered': ['ai','gpt','gemini','imagine'],
  'Fun Effects': ['compliment','character','wasted','stupid'],
  'Downloader': ['play','song','video','spotify','instagram','facebook','tiktok','ytmp4','ytdl'],
  'Utilities': ['url','lyrics','tts','translate','textmaker','viewonce'],
  'Meme Templates': ['heart','horny','circle','lgbt','lolice','namecard','tweet','ytcomment','gay','glass','jail','passed','triggered'],
  'Anime Reactions': ['neko','waifu','loli','nom','poke','cry','kiss','pat','hug','wink','facepalm']
};

// Helper to build categorized command list from discovered commands
function buildCategories(allCommands) {
  const categories = {};
  // Initialize categories
  for (const cat of Object.keys(CATEGORY_MAP)) categories[cat] = [];
  categories['Other'] = [];

  for (const cmd of allCommands) {
    const name = cmd.toLowerCase();
    let placed = false;
    for (const [cat, list] of Object.entries(CATEGORY_MAP)) {
      if (list.includes(name)) {
        categories[cat].push(name);
        placed = true;
        break;
      }
    }
    if (!placed) categories['Other'].push(name);
  }

  // Convert to array of {name, commands}
  return Object.keys(categories).map(name => ({ name, commands: categories[name].sort() })).filter(c => c.commands.length > 0);
}

// Pagination helpers
const INDEX_PER_PAGE = 6; // categories per index page
const CATEGORY_PER_PAGE = 8; // commands per category page

function formatIndexPage(categories, page = 1, lang = 'en') {
  const i18 = I18N[lang] || I18N.en;
  const totalPages = Math.max(1, Math.ceil(categories.length / INDEX_PER_PAGE));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * INDEX_PER_PAGE;
  const slice = categories.slice(start, start + INDEX_PER_PAGE);

  const lines = [];
  lines.push(i18.header(settings.botName || 'Mickey Glitch'));
  lines.push('');
  lines.push(i18.intro(settings.botName || 'Mickey Glitch'));
  lines.push('');
  lines.push('📚 Categories:');
  slice.forEach((c, i) => {
    lines.push(`${start + i + 1}. ${c.name} — ${c.commands.length} commands`);
  });
  lines.push('');
  lines.push(`Page ${p} of ${totalPages} — ${i18.replyInstructions}`);
  lines.push('');
  // meta token for reply parsing
  lines.push(`[help_meta:type=index;page=${p};per=${INDEX_PER_PAGE};pages=${totalPages};lang=${lang}]`);
  lines.push(i18.footer(settings.botName || 'Mickey Glitch'));
  return lines.join('\n');
}

function formatCategoryPage(category, catIndex, page = 1, lang = 'en') {
  const i18 = I18N[lang] || I18N.en;
  const totalPages = Math.max(1, Math.ceil(category.commands.length / CATEGORY_PER_PAGE));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * CATEGORY_PER_PAGE;
  const slice = category.commands.slice(start, start + CATEGORY_PER_PAGE);

  const lines = [];
  lines.push(`${i18.header(settings.botName || 'Mickey Glitch')} — ${category.name}`);
  lines.push('');
  lines.push(`Showing ${start + 1}-${start + slice.length} of ${category.commands.length} commands`);
  lines.push('');
  slice.forEach((cmd, i) => {
    lines.push(`${start + i + 1}. ${cmd}`);
  });
  lines.push('');
  lines.push(`${i18.replyInstructions} — Reply with number to view details, or 'back' to return to categories.`);
  lines.push('');
  lines.push(`[help_meta:type=cat;cat=${catIndex};page=${p};per=${CATEGORY_PER_PAGE};pages=${totalPages};lang=${lang}]`);
  lines.push(i18.footer(settings.botName || 'Mickey Glitch'));
  return lines.join('\n');
}

function formatCommandDetail(cmdName, lang = 'en') {
  const i18 = I18N[lang] || I18N.en;
  // Try to read description from module file if possible
  let desc = '';
  try {
    const filePath = path.join(__dirname, `${cmdName}.js`);
    if (fs.existsSync(filePath)) {
      const mod = require(filePath);
      desc = mod.description || mod.help || (mod.command ? `Usage: .${Array.isArray(mod.command) ? mod.command[0] : mod.command}` : '');
    }
  } catch (e) { /* ignore */ }

  const lines = [];
  lines.push(`${i18.commandDetail}: ${cmdName}`);
  lines.push('');
  lines.push(desc || 'No description available.');
  lines.push('');
  lines.push(`Example: .${cmdName} <args>`);
  lines.push('');
  lines.push(`[help_meta:type=cmd;cmd=${cmdName};lang=${lang}]`);
  return lines.join('\n');
}

// Main exposed help command
module.exports = async (sock, chatId, message, args) => {
  try {
    // Determine language: check sender's locale hint if available (fallback to 'en')
    let lang = 'en';
    // If args contains a language token like 'sw' we could support but default to 'en'

    const allCommands = module.exports.getAllCommands ? module.exports.getAllCommands() : [];
    const categories = buildCategories(allCommands);

    // Parse args: could be undefined, a number (category), two numbers (cat page), or a command name
    const raw = (args || '').toString().trim();
    if (!raw) {
      const text = formatIndexPage(categories, 1, lang);
      await sock.sendMessage(chatId, { text }, { quoted: message });
      return;
    }

    const parts = raw.split(/\s+/).slice(1); // args comes as like '.help 2' in main; strip leading token if present
    // If args string begins with a dot plus number, remove dot
    let argStr = raw.replace(/^\.help\s*/i, '').trim();
    const tokens = argStr.split(/\s+/).filter(Boolean);

    // Numeric only: category index
    if (/^\d+$/.test(tokens[0])) {
      const catIndex = parseInt(tokens[0], 10);
      const page = tokens[1] && /^\d+$/.test(tokens[1]) ? parseInt(tokens[1], 10) : 1;
      const idx = catIndex - 1; // categories array is 0-based
      if (idx < 0 || idx >= categories.length) {
        await sock.sendMessage(chatId, { text: I18N[lang].notFound }, { quoted: message });
        return;
      }
      const text = formatCategoryPage(categories[idx], catIndex, page, lang);
      await sock.sendMessage(chatId, { text }, { quoted: message });
      return;
    }

    // If starts with a known command name
    const cmdName = tokens[0].replace(/^\./, '').toLowerCase();
    if (allCommands.includes(cmdName)) {
      const text = formatCommandDetail(cmdName, lang);
      await sock.sendMessage(chatId, { text }, { quoted: message });
      return;
    }

    // Unknown arg: show index as fallback
    const text = formatIndexPage(categories, 1, lang);
    await sock.sendMessage(chatId, { text }, { quoted: message });

  } catch (err) {
    console.error('Help menu error (smart):', err);
    await sock.sendMessage(chatId, { text: '⚠️ Failed to load help menu. Please try again later.' }, { quoted: message });
  }
};

// Re-add getAllCommands utility so other parts can use it
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
      } catch (e) { }
    });
  } catch (e) {
    console.error('Error discovering commands:', e);
  }

  return Array.from(commands).sort();
};

// Return categorized list for external use (fresh computed)
module.exports.getCategories = function () {
  const allCommands = module.exports.getAllCommands ? module.exports.getAllCommands() : [];
  return buildCategories(allCommands);
};