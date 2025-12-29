const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

const configPath = path.join(__dirname, '..', 'data', 'autobio.json');

// Ensure file exists
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) || { enabled: false };
  } catch (e) {
    return { enabled: false };
  }
}

function saveConfig(cfg) {
  try { fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2)); } catch (e) { }
}

async function autoBioCommand(sock, chatId, message, args) {
  try {
    const sender = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(sender, sock, chatId);
    if (!message.key.fromMe && !isOwner) return sock.sendMessage(chatId, { text: '❌ Only Owner/Sudo can use this.' }, { quoted: message });

    const onoff = (args || '').trim().toLowerCase();
    if (!onoff || !['on', 'off'].includes(onoff)) {
      return sock.sendMessage(chatId, { text: 'Usage: .autobio on|off' }, { quoted: message });
    }

    const cfg = loadConfig();
    cfg.enabled = onoff === 'on';
    saveConfig(cfg);

    // Apply immediately when turning on
    if (cfg.enabled) {
      try { await applyAutoBioIfEnabled(sock); } catch (e) { /* ignore */ }
    }

    return sock.sendMessage(chatId, { text: `Auto-bio is now ${cfg.enabled ? 'ON' : 'OFF'}.` }, { quoted: message });
  } catch (err) {
    console.error('autobio command error:', err);
    return sock.sendMessage(chatId, { text: '❌ Error managing autobio.' }, { quoted: message });
  }
}

// Compose bio text
function buildAutoBio() {
  const ownerNum = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
  const ownerDisplay = ownerNum ? `Owner: +${ownerNum}` : 'Owner';
  const now = new Date().toLocaleString();
  return `✨ Powered by Mickey Bot\n⏰ ${now}\n💯 ${ownerDisplay}`;
}

// Apply autobio if enabled for this bot instance
async function applyAutoBioIfEnabled(sock) {
  try {
    const cfg = loadConfig();
    if (!cfg.enabled) return false;
    const bio = buildAutoBio();
    if (typeof sock.updateProfileStatus === 'function') {
      await sock.updateProfileStatus(bio);
      return true;
    }
    // older baileys versions may use setStatus
    if (typeof sock.setStatus === 'function') {
      await sock.setStatus(bio);
      return true;
    }
    console.warn('No method to update profile status on socket');
    return false;
  } catch (e) {
    console.error('applyAutoBioIfEnabled error:', e?.message || e);
    return false;
  }
}

module.exports = { autoBioCommand, applyAutoBioIfEnabled };