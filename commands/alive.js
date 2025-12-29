const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

// Enhanced tags mapping with emojis and colors
const tagsMap = {
  main: '💗 Information',
  jadibot: '🌟 Sub Bot',
  downloader: '📥 Downloads',
  game: '🎮 Games',
  gacha: '🎲 Gacha RPG',
  rg: '🔰 Registration',
  group: '👥 Groups',
  nable: '🎛️ Features',
  nsfw: '🔞 NSFW +18',
  buscadores: '🔎 Search Tools',
  sticker: '🌈 Stickers',
  econ: '💰 Economy',
  convertidor: '🌀 Converters',
  logo: '🎀 Logo Generator',
  tools: '🧰 Tools',
  randow: '🎁 Random',
  efec: '🎶 Audio Effects',
  owner: '👑 Creator'
};

// Main handler function - handles both plugin and main.js call conventions
let handler = async (m, { conn }) => {
  try {
    const userId = (m.mentionedJid && m.mentionedJid[0]) || m.sender;
    const user = (global.db && global.db.data && global.db.data.users && global.db.data.users[userId]) || {};
    const name = await conn.getName(userId);
    const botname = (conn.user && conn.user.name) || 'Bot 🌸';
    const fecha = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const hora = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const uptime = clockString(process.uptime() * 1000);
    const totalreg = global.db && global.db.data && global.db.data.users ? Object.keys(global.db.data.users).length : 0;
    const limit = user.limite || 0;

    const botTag = (conn.user && conn.user.jid && conn.user.jid.split('@')[0]) || 'bot';
    const botOfc = (conn.user && global.conn && conn.user.id === global.conn.user.id)
      ? `🌐 *Official Bot:* wa.me/${botTag}`
      : `🔗 *Sub Bot of:* wa.me/${global.conn && global.conn.user && global.conn.user.jid ? global.conn.user.jid.split('@')[0] : botTag}`;

    // Group commands by tags
    const grouped = {};
    const plugins = Object.values(global.plugins || {}).filter(p => !p.disabled);

    for (const plugin of plugins) {
      const cmds = Array.isArray(plugin.command) ? plugin.command : (plugin.command ? [plugin.command] : []);
      if (!cmds || cmds.length === 0) continue;
      const tagList = Array.isArray(plugin.tags) ? plugin.tags : (plugin.tags ? [plugin.tags] : []);
      const tag = tagList[0] || 'main';
      if (!grouped[tag]) grouped[tag] = [];
      for (const cmd of cmds) {
        if (typeof cmd !== 'string') continue;
        grouped[tag].push(cmd.replace(/^\^?\/?\.?/, '')); // clean common prefixes
      }
    }

    // Generate the menu text with better formatting
    let text = `\n╭─◇ *ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ʙᴏᴛ* ◇─╮ \n`;
    text += `│ 🙋 *User:* ${name}\n`;
    text += `│ 🏷 *Limit:* ${limit}\n`;
    text += `│ 📅 *Date:* ${fecha}\n`;
    text += `│ ⏱ *Time:* ${hora}\n`;
    text += `│ ⏳ *Uptime:* ${uptime}\n`;
    text += `│ 👥 *Users:* 78\n`;
    text += `│ ${botOfc}\n`;
    text += `╰──────────────╯\n`;

    // Add commands sections with better organization
    for (const tag of Object.keys(grouped).sort()) {
      const section = tagsMap[tag] || '📚 Other Commands';
      text += `\n╭─── *${section}* ───╮\n`;

      // Organize commands in two columns
      const commands = grouped[tag];
      const half = Math.ceil(commands.length / 2);
      const leftCol = commands.slice(0, half);
      const rightCol = commands.slice(half);
      const maxLength = Math.max(leftCol.length, rightCol.length);

      for (let i = 0; i < maxLength; i++) {
        const leftCmd = leftCol[i] ? `• ${leftCol[i].padEnd(18)}` : ''.padEnd(20);
        const rightCmd = rightCol[i] ? `• ${rightCol[i]}` : '';
        text += `│ ${leftCmd} ${rightCmd}\n`;
      }

      text += `╰─────────────────────╯\n`;
    }

    // Footer
    text += `\n✨ *Type .menu to see  command* ✨\n`;
    text += `\n🌸  Hello ${name}\n Thank you for using my bot *`;

    // Channel/Media info
    const channelRD = { id: '120363398106360290@newsletter', name: 'Mickey From Tanzania' };
    const banner = 'https://water-billimg.onrender.com/1761205727440.png';
    const redes = 'Thanks for appeciate and support';

    // Send the enhanced menu WITHOUT buttons - clean text only
    await conn.sendMessage(m.chat, {
      text: text.trim(),
      contextInfo: {
        mentionedJid: [m.sender, userId].filter(Boolean),
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: channelRD.id,
          newsletterName: channelRD.name,
          serverMessageId: -1,
        },
        forwardingScore: 999,
        externalAdReply: {
          title: `ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ʙᴏᴛ Command Menu`,
          body: `Available commands for ${name}`,
          thumbnailUrl: banner,
          sourceUrl: redes,
          mediaType: 1,
          showAdAttribution: false,
          renderLargerThumbnail: true,
        }
      }
    }, { quoted: m });
  } catch (error) {
    console.error('Error in help handler:', error);
    // Fallback error message
    await conn.sendMessage(m.chat, {
      text: '❌ *Error loading commands*\n\nPlease try again.'
    }, { quoted: m });
  }
};

handler.help = ['menu', 'help', 'commands'];
handler.tags = ['main'];
handler.command = ['menu', 'help', 'cmd', 'commands'];

// Helper function for uptime display
function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor((ms % 3600000) / 60000);
  let s = Math.floor((ms % 60000) / 1000);
  return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', s > 0 ? `${s}s` : ''].filter(Boolean).join(' ') || '0s';
}

// Wrapper function for main.js compatibility (old calling convention)
async function helpCommandWrapper(sock, chatId, message, userMessage) {
  try {
    // Convert old API format to new handler format
    const m = {
      chat: chatId,
      sender: message.key?.fromJid || message.key?.participant || sock.user?.id,
      mentionedJid: message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      key: message.key,
      message: message.message
    };
    
    const conn = sock;
    
    // Call the handler
    await handler(m, { conn });
  } catch (error) {
    console.error('Error in helpCommandWrapper:', error);
    try {
      await sock.sendMessage(chatId, {
        text: '❌ *Error loading commands*\n\nPlease try again.'
      }, { quoted: message });
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// Auto-sync commands from global.plugins (primary) and commands directory (fallback)
// This function automatically discovers all available commands
helpCommandWrapper.getAllCommands = function() {
  try {
    const commands = new Set();
    
    // PRIMARY: Get commands from global.plugins (auto-syncs with main.js)
    if (global.plugins && typeof global.plugins === 'object') {
      for (const key in global.plugins) {
        const plugin = global.plugins[key];
        if (!plugin || plugin.disabled) continue;
        
        // Extract commands from plugin
        if (Array.isArray(plugin.command)) {
          plugin.command.forEach(cmd => {
            if (typeof cmd === 'string') {
              commands.add(cmd.replace(/^\^?\/?\.?/, '').toLowerCase());
            }
          });
        } else if (typeof plugin.command === 'string') {
          commands.add(plugin.command.replace(/^\^?\/?\.?/, '').toLowerCase());
        }
      }
    }
    
    // FALLBACK: If no plugins found, scan commands directory
    if (commands.size === 0) {
      const commandsDir = path.join(__dirname);
      const files = fs.readdirSync(commandsDir);
      files
        .filter(file => file.endsWith('.js') && file !== 'help.js')
        .forEach(file => commands.add(file.replace('.js', '').toLowerCase()));
    }
    
    return Array.from(commands).sort();
  } catch (e) {
    console.error('Error in getAllCommands:', e);
    return [];
  }
};

module.exports = helpCommandWrapper;


