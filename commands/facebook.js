const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { text: 'Please provide a Facebook video URL. Example: .fb https://www.facebook.com/...' }, { quoted: message });
        }

        if (!url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: 'That is not a Facebook link.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Call a simple downloader API and pick the first plausible video URL.
        const apiUrl = `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`;
        const res = await axios.get(apiUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: s => s >= 200 && s < 500 });
        const data = res.data || {};

        // Flatten possible locations for the direct video URL
        const candidates = [];
        if (data.result?.media?.video_hd) candidates.push(data.result.media.video_hd);
        if (data.result?.media?.video_sd) candidates.push(data.result.media.video_sd);
        if (data.result?.url) candidates.push(data.result.url);
        if (data.result?.download) candidates.push(data.result.download);
        if (data.result?.video) candidates.push(data.result.video);
        if (data.data?.url) candidates.push(data.data.url);
        if (Array.isArray(data.data)) candidates.push(...data.data.map(i => i.url).filter(Boolean));
        if (data.url) candidates.push(data.url);
        if (data.download) candidates.push(data.download);
        if (data.video) candidates.push(typeof data.video === 'string' ? data.video : data.video?.url);

        const fbvid = candidates.find(u => typeof u === 'string' && u.startsWith('http')) || null;
        const title = data.title || data.result?.title || data.data?.title || 'Facebook Video';

        if (!fbvid) {
            return await sock.sendMessage(chatId, { text: '❌ Could not find a downloadable video URL. Try another link.' }, { quoted: message });
        }

        // Try to send by remote URL first
        try {
            await sock.sendMessage(chatId, { video: { url: fbvid }, mimetype: 'video/mp4', caption: title ? `📝 ${title}` : '' }, { quoted: message });
            return;
        } catch (err) {
            console.error('Sending by URL failed, falling back to download:', err.message);
        }

        // Fallback: download to temp file and send
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        const videoResp = await axios.get(fbvid, { responseType: 'stream', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.facebook.com/' } });
        const writer = fs.createWriteStream(tempFile);
        videoResp.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

        if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
            throw new Error('Downloaded file is empty');
        }

        await sock.sendMessage(chatId, { video: { url: tempFile }, mimetype: 'video/mp4', caption: title ? `📝 ${title}` : '' }, { quoted: message });

        try { fs.unlinkSync(tempFile); } catch (e) { console.error('Temp cleanup failed', e.message); }
    } catch (error) {
        console.error('Facebook command error:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while processing the Facebook link.' }, { quoted: message });
    }
}

module.exports = facebookCommand;