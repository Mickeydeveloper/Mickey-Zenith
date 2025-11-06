import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { OWNER_NUM } from './config.js';
import channelSender from './commands/channelSender.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const credsPath = path.join(__dirname, 'auth_info_baileys/creds.json');

const tempDir = path.join(__dirname, '.temp_bot_update');

const repoURL = 'https://github.com/Mickeydeveloper/Mickey-Zenith'; // replace this!


// Utility: Recursively copy files/folders (excluding .git)
function copyFolderContents(src, dest) {

  if (!fs.existsSync(src)) return;

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {

    if (entry.name === '.git' || entry.name === 'config.json' || entry.name === 'sessions.json' || entry.name === "config.js" || entry.name === "prem.json" || entry.name === "sessions") continue; // 🚫 skip .git folder and config.json

    const srcPath = path.join(src, entry.name);

    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {

      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });

      copyFolderContents(srcPath, destPath);

    } else {

      fs.copyFileSync(srcPath, destPath);

    }

  }
}


// Main logic
async function update(message, client) {
  const remoteJid = message.key.remoteJid;
  const sender = message.key.participant || message.key.remoteJid;
  
  // Check if sender is owner
  if (!sender.includes(OWNER_NUM)) {
    await client.sendMessage(remoteJid, { 
      text: "⛔ *Access Denied*\n\nSorry, only the bot owner can use the update command.", 
      quoted: message 
    });
    return;
  }

  await client.sendMessage(remoteJid, { 
    text: "🔄 *Bot Update Process Started*\n\n_Please wait while I update the system..._",
    quoted: message
  });

  // body...
  
  console.log('🔄 Pulling latest code from GitHub...');

  try {

    if (fs.existsSync(tempDir)) {

      execSync(`rm -rf ${tempDir}`);
    }

    execSync(`git clone ${repoURL} ${tempDir}`);

    console.log('🔁 Copying updated files to root...');

    copyFolderContents(tempDir, __dirname);

    console.log('✅ Update completed ...');

    await import('./main.js');

  } catch (err) {

    console.error('❌ Failed to update bot:', err.message);
  }


  try {
    await channelSender(message, client, `✅ *Update Completed Successfully*\n\n• Bot has been updated to the latest version\n• All systems are functioning normally\n\n_Thank you for using our service_\n\n*Powered by Mickey Tech*`, 2);
  } catch (error) {
    console.error('Error sending completion message:', error);
  }
};

export default update;















