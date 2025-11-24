import fs from 'fs';
import path from 'path';
import configManager from '../utils/manageConfigs.js';
import { OWNER_NUM } from '../config.js';

// Settings file path (stored in project root)
const SETTINGS_PATH = path.join(process.cwd(), 'anti-call-settings.json');

// Default settings
const defaultSettings = {
  rejectCalls: true,
  blockCaller: false,
  notifyAdmin: true,
  autoReply: "🚫 I don't accept calls. Please send a text message instead.",
  blockedUsers: [],
  adminNumber: '255615944741@s.whatsapp.net'
};

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading anti-call settings:', error);
  }
  return { ...defaultSettings };
}

// Save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving anti-call settings:', error);
  }
}

// Initialize settings
let settings = loadSettings();

// Helper to format a JID for storage/lookup
const normalizeJid = (jid) => {
  if (!jid) return jid;
  return jid.includes('@') ? jid : (jid + '@s.whatsapp.net');
};

// Show status helper
async function showStatus(sock, sender, quoted) {
  const status = settings.rejectCalls ? 'ENABLED' : 'DISABLED';
  const blockedCount = Array.isArray(settings.blockedUsers) ? settings.blockedUsers.length : 0;
  const statusMessage = [
    '🤖 *Anti-Call Plugin Status*',
    `• Protection: ${status}`,
    `• Blocked users: ${blockedCount}`,
    `• Auto-reply: ${settings.autoReply ? 'ON' : 'OFF'}`,
    `• Admin notifications: ${settings.notifyAdmin ? 'ON' : 'OFF'}`,
    '\nUse *.anticall on* to enable or *.anticall off* to disable.'
  ].join('\n');

  await sock.sendMessage(sender, { text: statusMessage }, { quoted });
}

// Init: attach call listener to a socket
async function init(sock) {
  if (!sock || !sock.ev) return;
  console.log('Anti-call plugin initialized');

  sock.ev.on('call', async (callDataArray) => {
    try {
      for (const callData of callDataArray) {
        const { id, from, status, isVideo } = callData;
        if (status !== 'offer') continue; // only handle incoming offers

        const caller = normalizeJid(from);
        const callType = isVideo ? 'video' : 'voice';

        console.log(`Incoming ${callType} call from: ${caller}`);

        // If caller is blocked, reject and continue
        if (Array.isArray(settings.blockedUsers) && settings.blockedUsers.includes(caller)) {
          try { await sock.rejectCall(id, from); } catch (e) {}
          console.log(`Blocked user ${caller} attempted a call, rejected.`);
          continue;
        }

        // Reject the call if enabled
        if (settings.rejectCalls) {
          try {
            await sock.rejectCall(id, from);
            console.log(`Call from ${caller} rejected.`);

            if (settings.autoReply) {
              try {
                await sock.sendMessage(caller, {
                  text: settings.autoReply,
                  contextInfo: {
                    externalAdReply: {
                      title: 'Call Rejected',
                      body: "This bot doesn't accept calls",
                      thumbnailUrl: 'https://files.catbox.moe/6n99vh.jpeg',
                      mediaType: 1
                    }
                  }
                });
              } catch (e) {
                console.debug('Failed to send anti-call autoReply:', e?.message || e);
              }
            }
          } catch (error) {
            console.error('Error rejecting call:', error?.message || error);
          }
        }

        // Optionally block the caller
        if (settings.blockCaller) {
          if (!settings.blockedUsers.includes(caller)) {
            settings.blockedUsers.push(caller);
            saveSettings(settings);
            console.log(`User ${caller} has been blocked from calling.`);
          }
        }

        // Notify admin
        if (settings.notifyAdmin && settings.adminNumber) {
          try {
            const message = `📞 *Anti-Call Alert*\n\nCaller: ${caller}\nType: ${callType} call\nStatus: Automatically rejected`;
            await sock.sendMessage(settings.adminNumber, {
              text: message,
              contextInfo: {
                externalAdReply: {
                  title: 'Call Blocked',
                  body: 'Anti-Call Protection',
                  thumbnailUrl: 'https://files.catbox.moe/6n99vh.jpeg',
                  mediaType: 1
                }
              }
            });
          } catch (err) {
            console.error('Error notifying admin:', err?.message || err);
          }
        }
      }
    } catch (error) {
      console.error('Error handling call event:', error?.message || error);
    }
  });
}

// Command handler: / .anticall <on|off|status|block|unblock>
async function handler({ sock, m, sender, args = [], contextInfo = {}, isGroup = false }) {
  try {
    const action = (args[0] || '').toLowerCase();
    const userNumber = sender?.split('@')[0];

    // No authorization required: allow all users to use this command

    if (!action) return await showStatus(sock, sender, m);

    switch (action) {
      case 'on':
        settings.rejectCalls = true; saveSettings(settings);
        await sock.sendMessage(sender, { text: '✅ Anti-call protection enabled.' }, { quoted: m });
        break;
      case 'off':
        settings.rejectCalls = false; saveSettings(settings);
        await sock.sendMessage(sender, { text: '✅ Anti-call protection disabled.' }, { quoted: m });
        break;
      case 'status':
        await showStatus(sock, sender, m);
        break;
      case 'block': {
        if (args[1]) {
          const numberToBlock = normalizeJid(args[1].replace(/[^0-9]/g, ''));
          if (!settings.blockedUsers.includes(numberToBlock)) {
            settings.blockedUsers.push(numberToBlock);
            saveSettings(settings);
            await sock.sendMessage(sender, { text: `✅ User ${args[1]} has been blocked from calling.` }, { quoted: m });
          } else {
            await sock.sendMessage(sender, { text: `ℹ️ User ${args[1]} is already blocked.` }, { quoted: m });
          }
        } else {
          await sock.sendMessage(sender, { text: '❌ Please specify a user to block. Usage: .anticall block [number]' }, { quoted: m });
        }
        break;
      }
      case 'unblock': {
        if (args[1]) {
          const numberToUnblock = normalizeJid(args[1].replace(/[^0-9]/g, ''));
          if (settings.blockedUsers.includes(numberToUnblock)) {
            settings.blockedUsers = settings.blockedUsers.filter(u => u !== numberToUnblock);
            saveSettings(settings);
            await sock.sendMessage(sender, { text: `✅ User ${args[1]} has been unblocked.` }, { quoted: m });
          } else {
            await sock.sendMessage(sender, { text: `ℹ️ User ${args[1]} is not blocked.` }, { quoted: m });
          }
        } else {
          await sock.sendMessage(sender, { text: '❌ Please specify a user to unblock. Usage: .anticall unblock [number]' }, { quoted: m });
        }
        break;
      }
      default:
        await sock.sendMessage(sender, { text: '❌ Invalid option. Usage: .anticall [on|off|status|block|unblock]' }, { quoted: m });
    }
  } catch (error) {
    console.error('Anti-call command error:', error?.message || error);
    try {
      await sock.sendMessage(sender, { text: '❌ Error processing anti-call command.' }, { quoted: m });
    } catch (e) {}
  }
}

export default { init, handler };
