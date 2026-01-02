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
    ''
  ).trim();
}

function listCommandFiles() {
  const commandsDir = __dirname; // this file is in commands/
  const files = fs.readdirSync(commandsDir);
  const cmds = files
    .filter(f => f.endsWith('.js'))
    .map(f => path.basename(f, '.js'))
    .filter(name => !EXCLUDE.includes(name))
    .sort((a, b) => a.localeCompare(b));
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

  // Improved header formatting with extra runtime/system info and greeting
  const header = `┏━━〔 ${settings.botName || '𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑'} 〕━━┓\n` +
    `┃ 🧑‍🔧 Owner: ${settings.botOwner || 'Mickey'}\n` +
    `┃ ✨ Hello: ${name || user || 'Unknown'}\n` +
    `┃ 🔖 Version: v${settings.version || '?.?'}  |  ⏱ Uptime: ${runtime || getUptime()}\n` +
    `┃\n` +
    `┃ ▸ Runtime: ${runtime || getUptime()}\n` +
    `┃ ▸ Mode: ${mode || settings.commandMode || 'public'}\n` +
    `┃ ▸ Prefix: ${prefix || settings.prefix || '.'}\n` +
    `┃ ▸ RAM: ${ramUsed || '?'} / ${ramTotal || '?'} GB\n` +
    `┃ ▸ Time: ${time || new Date().toLocaleTimeString('en-GB', { hour12: false })}\n` +
    `┃ ▸ User: ${name || user || 'Unknown'}\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  const title = `*Commands*\n\n`;

  const list = cmdList.map(c => `• ${c}`).join('\n');

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
    const memUsedGB = (process.memoryUsage().rss / (1024 ** 3));
    const memTotalGB = (os.totalmem() / (1024 ** 3));

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
      ramUsed: memUsedGB.toFixed(2),
      ramTotal: memTotalGB.toFixed(2),
      time: timeNow,
      user: userId,
      name: displayName
    });

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
          renderLargerThumbnail: true
        }
      }
    }, { quoted: message });

  } catch (error) {
    console.error('helpCommand Error:', error);
    await sock.sendMessage(chatId, { text: `*Error:* ${error.message}\n\n${FALLBACK}` }, { quoted: message });
  }
}

module.exports = helpCommand;