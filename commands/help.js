// ──────────────────────────────────────────────────────────────
//  Help – Text-based, auto-synced from `commands/` folder (no slides)
// ──────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const settings = require('../settings');

/**
 * NOTE:
 * - This help command auto-builds the command list by reading the `commands/` folder.
 * - To hide commands from the help output, add their filename (without extension) to `EXCLUDE`.
 */
const EXCLUDE = [
  'help' // exclude self by default; add other command base names here (e.g., 'debug')
];

const PAGE_SIZE = 36; // number of commands per page

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

function buildHelpMessage(cmdList, page = 1) {
  const total = cmdList.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * PAGE_SIZE;
  const slice = cmdList.slice(start, start + PAGE_SIZE);

  const header = `┏━━〔 *${settings.botName || 'Bot'}* 〕━━┓\n` +
    `┃ 🧑‍🔧 Owner: ${settings.botOwner || 'owner'}\n` +
    `┃ 🔖 Version: v${settings.version || '?.?'}  |  ⏱ Uptime: ${getUptime()}\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  const title = `*Commands*  (Page ${p}/${totalPages})\n` +
    `Use *help <page>* to view other pages\n\n`;

  const list = slice.map((c, i) => `• ${c}`).join('\n');

  const footer = `\n\n*Total commands:* ${total}  —  *Excluded:* ${EXCLUDE.length}`;

  return header + title + list + footer;
}

const FALLBACK = `*Help*\nUnable to build dynamic help list.`;

async function helpCommand(sock, chatId, message) {
  if (!sock || !chatId) return console.error('Missing sock or chatId');

  try {
    const text = readMessageText(message);
    let page = 1;

    // Parse page number if user sent like: "help 2" or ".help 2"
    const m = text.match(/(\d+)/);
    if (m) page = parseInt(m[1], 10) || 1;

    const cmdList = listCommandFiles();
    if (!cmdList.length) {
      await sock.sendMessage(chatId, { text: FALLBACK }, { quoted: message });
      return;
    }

    const helpText = buildHelpMessage(cmdList, page);
    await sock.sendMessage(chatId, { text: helpText }, { quoted: message });

  } catch (error) {
    console.error('helpCommand Error:', error);
    await sock.sendMessage(chatId, { text: `*Error:* ${error.message}\n\n${FALLBACK}` }, { quoted: message });
  }
}

module.exports = helpCommand;