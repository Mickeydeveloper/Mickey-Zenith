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

function buildHelpMessage(cmdList) {
  const total = cmdList.length;

  const header = `┏━━〔 *${settings.botName || 'Bot'}* 〕━━┓\n` +
    `┃ 🧑‍🔧 Owner: ${settings.botOwner || 'owner'}\n` +
    `┃ 🔖 Version: v${settings.version || '?.?'}  |  ⏱ Uptime: ${getUptime()}\n` +
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

    const cmdList = listCommandFiles();
    if (!cmdList.length) {
      await sock.sendMessage(chatId, { text: FALLBACK }, { quoted: message });
      return;
    }

    const helpText = buildHelpMessage(cmdList);
    await sock.sendMessage(chatId, { text: helpText }, { quoted: message });

  } catch (error) {
    console.error('helpCommand Error:', error);
    await sock.sendMessage(chatId, { text: `*Error:* ${error.message}\n\n${FALLBACK}` }, { quoted: message });
  }
}

module.exports = helpCommand;