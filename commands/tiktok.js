const axios = require('axios');
const { getBuffer } = require('../lib/myfunc');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    throw lastError;
}

function findFirstUrlInObj(obj) {
    const urlRegex = /(https?:\/\/[\w\-./?=&#%]+\.(mp4|m3u8|mov|ts)|https?:\/\/[\w\-./?=&#%]+)/i;
    if (!obj) return null;
    if (typeof obj === 'string') {
        const m = obj.match(urlRegex);
        return m ? m[0] : null;
    }
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const v = findFirstUrlInObj(item);
            if (v) return v;
        }
    } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const v = findFirstUrlInObj(obj[key]);
            if (v) return v;
        }
    }
    return null;
}

async function getTiktokDownload(url) {
    const apiUrl = `https://api.vreden.my.id/api/v1/download/tiktok?url=${encodeURIComponent(url)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (!res || !res.data) throw new Error('No response from TikTok API');

    // Try common paths first
    const d = res.data;
    const candidates = [
        d.result?.video?.play, d.result?.nowm, d.result?.nowm || d.result?.video || d.result?.mp4,
        d.data?.play, d.data?.video, d.video, d.download, d.url
    ];

    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('http')) return { url: c, meta: d };
    }

    // fallback: scan the whole JSON for first URL
    const found = findFirstUrlInObj(d);
    if (found) return { url: found, meta: d };

    throw new Error('Could not find a video URL in API response');
}

async function tiktokCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .tiktok <tiktok link>' }, { quoted: message });
            return;
        }

        // React to show we're processing
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        // Validate URL
        if (!query.startsWith('http://') && !query.startsWith('https://')) {
            await sock.sendMessage(chatId, { text: 'Please provide a valid URL (starting with http(s)).' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // Call API
        const { url: videoUrl, meta } = await getTiktokDownload(query);

        if (!videoUrl) {
            throw new Error('No video URL returned from API');
        }

        // Try to get thumbnail for nicer preview
        let thumbBuffer;
        try {
            const potentialThumb = meta?.result?.thumbnail || meta?.result?.cover || meta?.data?.thumbnail || meta?.data?.cover;
            if (potentialThumb) thumbBuffer = await getBuffer(potentialThumb);
        } catch (e) {
            thumbBuffer = null; // ignore
        }

        // Update reaction to downloading
        await sock.sendMessage(chatId, { react: { text: '⬇️', key: message.key } });

        // Send video by URL
        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            fileName: 'tiktok.mp4',
            caption: '*TikTok Download*',
            jpegThumbnail: thumbBuffer
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[TIKTOK] Error:', err?.message || err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download TikTok video: ' + (err?.message || 'Unknown error') }, { quoted: message });
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }); } catch (e) { /* ignore */ }
    }
}

module.exports = tiktokCommand;
