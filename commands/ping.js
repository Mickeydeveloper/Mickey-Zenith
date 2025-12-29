const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    seconds = Math.floor(seconds);
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

async function pingCommand(sock, chatId, message) {
    try {
        // Send quick pong to measure send latency
        const start = Date.now();
        await sock.sendMessage(chatId, { text: 'Pong! 🏓' }, { quoted: message });
        const latency = Date.now() - start;

        // Uptime and system info
        const processUptime = formatTime(process.uptime());
        const hostUptime = formatTime(os.uptime());
        const cpuCount = os.cpus().length;
        const platform = `${os.platform()} ${os.arch()}`;
        const nodeVersion = process.version;

        // Memory
        const totalMemGB = (os.totalmem() / (1024 ** 3));
        const freeMemGB = (os.freemem() / (1024 ** 3));
        const usedMemProc = process.memoryUsage();
        const rssMB = (usedMemProc.rss / (1024 ** 2)).toFixed(2);
        const heapUsedMB = (usedMemProc.heapUsed / (1024 ** 2)).toFixed(2);

        // Version from settings (fallback)
        const botVersion = settings && settings.version ? settings.version : 'unknown';

        const botInfo = `┏━━〔 *Mickey Glitch™* 〕━━┓
┃
┃ 🚀 Ping        : ${latency} ms
┃ ⏱️ Uptime      : ${processUptime}
┃ 🖥️ Host Uptime  : ${hostUptime}
┃ 💻 CPU Cores   : ${cpuCount}
┃ 🧠 RAM (free)  : ${freeMemGB.toFixed(2)} GB / ${totalMemGB.toFixed(2)} GB
┃ 🔧 Proc memory : RSS ${rssMB} MB · Heap ${heapUsedMB} MB
┃ 🔖 Bot version  : v${botVersion}
┃ 🧩 Node         : ${nodeVersion}
┃ 📍 Platform     : ${platform}
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛`;

        await sock.sendMessage(chatId, { text: botInfo }, { quoted: message });

    } catch (error) {
        console.error('Error in ping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get bot status.' }, { quoted: message });
    }
}

module.exports = pingCommand;
