// ──────────────────────────────────────────────────────────────
//  Help – Text-based, auto-synced from `commands/` folder (no slides)
// ──────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');

/**
 * NOTE:
 * - This help command auto-builds the command list by reading the `commands/` folder.
 * - To hide commands from the help output, add their filename (without extension) to `EXCLUDE`.
 */
const EXCLUDE = [
  'help' // exclude self by default; add other command base names here (e.g., 'debug')
];

// Banner image used in externalAdReply (falls back to a hosted image)
const BANNER = 'https://water-billimg.onrender.com/1761205727440.png';

// No paging — always show the full, auto-synced command list

function getUptime() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function readMessageText(message) {
  if (!message) return '';
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function getCommandDescription(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).slice(0, 8);
    for (const ln of lines) {
      const t = ln.trim();
      if (!t) continue;
      if (t.startsWith('//')) return t.replace(/^\/\/\s?/, '').trim();
      if (t.startsWith('/*')) return t.replace(/^\/\*\s?/, '').replace(/\*\/$/, '').trim();
      if (t.startsWith('*')) return t.replace(/^\*\s?/, '').trim();
    }
  } catch (e) {
    // ignore and return empty description
  }
  return '';
}

function listCommandFiles() {
  const commandsDir = __dirname; // this file is in commands/
  let files = [];
  try {
    files = fs.readdirSync(commandsDir);
  } catch (e) {
    return [];
  }
  const cmds = files
    .filter(f => f.endsWith('.js'))
    .map(f => path.basename(f, '.js'))
    .filter(name => !EXCLUDE.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const fp = path.join(commandsDir, `${name}.js`);
      const desc = getCommandDescription(fp);
      return { name, desc };
    });
  return cmds;
}

function buildHelpMessage(cmdList, opts = {}) {
  const total = cmdList.length;
  const {
    runtime,
    mode,
    prefix,
    ramUsed,
    ramTotal,
    time,
    user,
    name
  } = opts;

  const header = `┏━━〔 ${settings.botName || '𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑'} 〕━━┓\n` +
    `┃ 👑 Owner : ${settings.botOwner || 'Mickey'}\n` +
    `┃ ✨ User  : ${name || user || 'Unknown'}  |  🔖 v${settings.version || '?.?'}\n` +
    `┃ ⏱ Uptime : ${runtime || getUptime()}  |  ⌚ ${time || new Date().toLocaleTimeString('en-GB', { hour12: false })}\n` +
    `┃ 🛡 Mode  : ${mode || settings.commandMode || 'public'}  |  Prefix: ${prefix || settings.prefix || '.'}\n` +
    `┃ 🧠 RAM   : ${ramUsed || '?'} / ${ramTotal || '?'} GB\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  const title = `*• Commands (${total})*\n\n`;

  const list = cmdList.map(c => {
    const nameStr = `${prefix}${c.name}`;
    const descStr = c.desc ? ` — ${c.desc}` : '';
    return `• ${nameStr}${descStr}`;
  }).join('\n');

  const footer = `\n\n*Total commands:* ${total}  —  *Excluded:* ${EXCLUDE.length}`;

  return header + title + list + footer;
} 

const FALLBACK = `*Help*\nUnable to build dynamic help list.`;

async function helpCommand(sock, chatId, message) {
  if (!sock || !chatId) return console.error('Missing sock or chatId');

  try {
    const text = readMessageText(message);

    // Gather runtime & system info to display in header
    const runtime = getUptime();
    const mode = settings.commandMode || 'public';
    const prefix = settings.prefix || '.';
    const timeNow = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const memUsedGB = (process.memoryUsage().rss / (1024 ** 3)).toFixed(2);
    const memTotalGB = (os.totalmem() / (1024 ** 3)).toFixed(2);

    // Determine requesting user (best-effort) and resolve display name where possible
    let senderJid = null;
    let userId = 'Unknown';
    let displayName = 'Unknown';
    try {
      const sender = message?.key?.participant || message?.key?.from || message?.sender || message?.participant;
      if (sender) {
        senderJid = typeof sender === 'string' ? sender : String(sender);
        userId = senderJid.split('@')[0];
        try {
          if (typeof sock.getName === 'function') {
            displayName = await sock.getName(senderJid);
          } else {
            displayName = userId;
          }
        } catch (e) {
          displayName = userId;
        }
      }
    } catch (e) {}

    const cmdList = listCommandFiles();
    if (!cmdList.length) {
      await sock.sendMessage(chatId, { text: FALLBACK }, { quoted: message });
      return;
    }

    const helpText = buildHelpMessage(cmdList, {
      runtime,
      mode,
      prefix,
      ramUsed: memUsedGB,
      ramTotal: memTotalGB,
      time: timeNow,
      user: userId,
      name: displayName
    });

    // If message is large, send as a text file instead to avoid truncation issues
    if (helpText.length > 4000) {
      try {
        const tmpPath = path.join(os.tmpdir(), `help-${Date.now()}.txt`);
        fs.writeFileSync(tmpPath, helpText, 'utf8');
        const fileBuf = fs.readFileSync(tmpPath);
        await sock.sendMessage(chatId, {
          document: fileBuf,
          fileName: `help_${settings.botName?.replace(/\s+/g, '_') || 'bot'}_${new Date().toISOString().slice(0,10)}.txt`,
          mimetype: 'text/plain',
          caption: `📚 Help — full command list (v${settings.version || '?.?'})`
        }, { quoted: message });
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      } catch (e) {
        console.error('Failed to send help as file:', e);
        await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
      }
      return;
    }

    // Normal text message with externalAdReply card
    await sock.sendMessage(chatId, {
      text: helpText,
      contextInfo: {
        mentionedJid: senderJid ? [senderJid] : undefined,
        externalAdReply: {
          title: `${settings.botName || 'Mickey Glitch'} — Commands`,
          body: `v${settings.version || '?.?'}`,
          thumbnailUrl: BANNER,
          sourceUrl: 'https://github.com/Mickeydeveloper/Mickey-Glitch',
          mediaType: 1,
          mediaUrl: 'https://github.com/Mickeydeveloper/Mickey-Glitch',
          showAdAttribution: true,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: message });

  } catch (error) {
    console.error('helpCommand Error:', error);
    const msg = `*Error:* ${error?.message || error}\n\n${FALLBACK}`;
    await sock.sendMessage(chatId, { text: msg }, { quoted: message });
  }
}

module.exports = helpCommand;