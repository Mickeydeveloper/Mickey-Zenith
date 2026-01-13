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

function collectAllUrls(obj, out = new Set()) {
    if (!obj) return out;
    const urlRegex = /https?:\/\/[^\s\"'<>]+/ig;
    if (typeof obj === 'string') {
        let m;
        while ((m = urlRegex.exec(obj)) !== null) out.add(m[0]);
        return out;
    }
    if (Array.isArray(obj)) {
        for (const item of obj) collectAllUrls(item, out);
        return out;
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) collectAllUrls(obj[key], out);
        return out;
    }
    return out;
}

function isImageUrl(u) {
    return /\.(jpe?g|png|webp|gif|bmp)(?:\?|$)/i.test(u);
}

function isVideoLike(u) {
    return /\.(mp4|webm|m3u8|mov|ts|3gp|mkv)(?:\?|$)/i.test(u) || /(video|play|download|mp4|nowm)/i.test(u);
}

async function validateVideoUrl(url) {
    try {
        // Try HEAD first
        const head = await axios.head(url, { ...AXIOS_DEFAULTS, timeout: 5000, maxRedirects: 5, validateStatus: s => s >= 200 && s < 400 });
        const ct = (head.headers['content-type'] || '').toLowerCase();
        if (ct.startsWith('video') || ct.includes('octet-stream')) return true;
    } catch (e) {
        // ignore, try GET stream
    }

    try {
        const r = await axios.get(url, { ...AXIOS_DEFAULTS, responseType: 'stream', timeout: 8000, maxRedirects: 5 });
        const ct = (r.headers['content-type'] || '').toLowerCase();
        if (r.data && typeof r.data.destroy === 'function') r.data.destroy();
        if (ct.startsWith('video') || ct.includes('octet-stream')) return true;
    } catch (e) {
        // failed to fetch
    }

    return false;
}

async function getTiktokDownload(url) {
    const apiUrl = `https://apis-starlights-team.koyeb.app/starlight/tiktok?url=${encodeURIComponent(url)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (!res || !res.data) throw new Error('No response from TikTok API');

    const d = res.data;

    // Collect candidate URLs from known fields and from scanning the whole response
    const candidatesOrdered = [];
    const pushIf = (u) => { if (u && typeof u === 'string' && u.startsWith('http')) candidatesOrdered.push(u); };

    // Prefer common locations
    pushIf(d.result?.video?.play);
    pushIf(d.result?.nowm);
    pushIf(d.result?.video || d.result?.mp4);
    pushIf(d.data?.play);
    pushIf(d.data?.video);
    pushIf(d.video);
    pushIf(d.download);
    pushIf(d.url);

    // Add all URLs found in the object
    const all = Array.from(collectAllUrls(d));
    for (const u of all) pushIf(u);

    // Deduplicate
    const unique = [...new Set(candidatesOrdered)];

    // Filter out obvious images first
    const nonImage = unique.filter(u => !isImageUrl(u));

    // Sort: video-like URLs first
    nonImage.sort((a, b) => (isVideoLike(b) ? 1 : 0) - (isVideoLike(a) ? 1 : 0));

    // Try validating candidates (HEAD/stream) and return first valid video URL
    for (const candidate of nonImage) {
        try {
            const ok = await validateVideoUrl(candidate);
            if (ok) return { url: candidate, meta: d };
        } catch (e) {
            // ignore and continue
        }
    }

    // As a last resort, allow video-like URLs even if validation failed
    const fallback = nonImage.find(u => isVideoLike(u));
    if (fallback) return { url: fallback, meta: d };

    // If still nothing, try any URL (maybe it's behind redirects)
    if (unique.length) return { url: unique[0], meta: d };

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
