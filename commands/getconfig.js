import configManager from '../utils/manageConfigs.js';

function formatSettings(settings) {
  return Object.entries(settings).map(([key, value]) => {
    if (typeof value === 'boolean') value = value ? "✅" : "❌";
    if (Array.isArray(value)) value = value.length ? value.join(", ") : "None";
    if (value === "") value = "None";
    return `*${key}*: ${value}`;
  }).join('\n');
}

export async function getconf(message, client, num) {
  const remoteJid = message.key.remoteJid;
  const conf = configManager.config?.users[num];

  if (!conf) {
    return await client.sendMessage(remoteJid, { text: "⚠️ No config found for this user." });
  }

  const formatted = formatSettings(conf);
  const msg = "*Your Current Settings:*\n\n" + formatted;

  await client.sendMessage(remoteJid, { text: msg });
}

export default getconf;
