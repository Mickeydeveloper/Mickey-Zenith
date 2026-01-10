const axios = require('axios');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

const MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024; // 150 MB max local download (adjustable)

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

/**
 * Helper to extract the best download link from various API response shapes
 */
function extractBestVideo(data) {
    // Check for array of results (often contains different formats/qualities)
    if (data.results && Array.isArray(data.results)) {
        return data.results[0]; // Usually highest quality is first
    }
    // Handle Izumi/Vreden standard response
    if (data.url) return { url: data.url, type: 'video/mp4' };
    // Handle Okatsu response
    if (data.result?.mp4) return { url: data.result.mp4, type: 'video/mp4' };
    if (data.result?.url) return { url: data.result.url, type: 'video/mp4' };
    
    return null;
}
async function getIzumiVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    const best = extractBestVideo(res.data);
    if (best) return { download: best.url, title: res.data.title || res.data.result?.title || 'Video', mime: best.type || 'video/mp4' };
    throw new Error('Izumi API failed');
}

async function getVredenVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.vreden.my.id/api/v1/download/play/video?query=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    const result = res?.data?.result || res?.data;
    // Check for high res first, fallback to standard mp4
    const downloadUrl = result?.video_hd || result?.video_sd || result?.mp4 || result?.url;
    if (downloadUrl) return { download: downloadUrl, title: result?.title || res?.data?.title || 'Video', mime: 'video/mp4' };
    throw new Error('Vreden API failed');
}

async function getYtdlVideoByUrl(youtubeUrl) {
    // Only attempt for YouTube URLs
    try {
        if (!ytdl.validateURL(youtubeUrl)) throw new Error('Not a valid YouTube URL');
        const info = await ytdl.getInfo(youtubeUrl);
        // prefer combined audio+video formats
        const formats = ytdl.filterFormats(info.formats, 'videoandaudio') || [];

        // Sort by quality (resolution + bitrate) descending
        formats.sort((a, b) => {
            const qa = Number(a.bitrate || a.averageBitrate || 0);
            const qb = Number(b.bitrate || b.averageBitrate || 0);
            return qb - qa;
        });

        // Prefer mp4 containers if possible
        const mp4Preferred = formats.filter(f => (f.container === 'mp4' || (f.mimeType || '').includes('mp4')) && f.contentLength);

        // Try to pick highest quality <= MAX_DOWNLOAD_BYTES, otherwise pick highest available
        let chosen = mp4Preferred.find(f => Number(f.contentLength) <= MAX_DOWNLOAD_BYTES) || mp4Preferred[0] || formats.find(f => Number(f.contentLength) <= MAX_DOWNLOAD_BYTES) || formats[0];
        if (!chosen) throw new Error('No suitable format from ytdl');

        const tmpDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const titleSafe = (info.videoDetails?.title || 'video').replace(/[\\/:*?"<>|]+/g, '').slice(0, 120) || 'video';
        const ext = chosen.container || ((chosen.mimeType || 'video/mp4').split('/')[1] || 'mp4').split(';')[0].split('+')[0];
        const tmpFile = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${titleSafe}.${ext}`);

        await new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, { format: chosen });
            const fileStream = fs.createWriteStream(tmpFile);
            stream.pipe(fileStream);
            let errored = false;
            stream.on('error', (e) => { errored = true; reject(e); });
            fileStream.on('finish', () => { if (!errored) resolve(); });
            fileStream.on('error', (e) => { errored = true; reject(e); });
        });

        const mime = (chosen.mimeType && chosen.mimeType.split(';')[0]) || 'video/mp4';
        return { download: tmpFile, title: info.videoDetails?.title || 'Video', mime, isFile: true };
    } catch (e) {
        throw new Error('ytdl failed: ' + (e.message || e));
    }
}

// Download a remote URL to a temp file (with size guard)
async function downloadRemoteToTemp(url, maxBytes = MAX_DOWNLOAD_BYTES) {
    const tmpDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2,8)}.tmp`);

    const res = await axios.get(url, { ...AXIOS_DEFAULTS, responseType: 'stream', maxRedirects: 5 });
    const length = Number(res.headers['content-length'] || 0);
    if (length && length > maxBytes) {
        res.data.destroy();
        throw new Error(`Remote file too large (${Math.round(length/1024/1024)} MB)`);
    }

    return await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tmpFile);
        let downloaded = 0;
        let aborted = false;
        res.data.on('data', chunk => {
            downloaded += chunk.length;
            if (downloaded > maxBytes) {
                aborted = true;
                res.data.destroy();
                writer.destroy();
                try { fs.unlinkSync(tmpFile); } catch (e) {}
                reject(new Error('Downloaded file exceeds max allowed size'));
            }
        });
        res.data.pipe(writer);
        res.data.on('error', err => { aborted = true; try { writer.destroy(); } catch (e) {} reject(err); });
        writer.on('finish', () => { if (!aborted) resolve(tmpFile); });
        writer.on('error', err => { try { fs.unlinkSync(tmpFile); } catch (e) {} reject(err); });
    });
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = String(text).split(/\s+/).slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
            return;
        }

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';

        if (/^https?:\/\//.test(searchQuery)) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Send Processing Notification with Thumbnail
        const ytId = (videoUrl.match(/(?:youtu\.be\/|v=|embed\/|\/v\/)([a-zA-Z0-9_-]{11})/) || [])[1];
        const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg` : undefined);

        if (thumb) {
            await sock.sendMessage(chatId, {
                image: { url: thumb },
                caption: `*Mickey video download* \n\n*Title:* ${videoTitle || 'Searching...'}\n*Status:* Fetching best quality...`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: `*Mickey Tanzanite Era* 💎\n\n*Title:* ${videoTitle || 'Searching...'}\n*Status:* Fetching best quality...` }, { quoted: message });
        }

        // API Fallback Chain (try Izumi first, then Vreden)
        let videoData;
        const apiAttempts = [
            { fn: () => getIzumiVideoByUrl(videoUrl), name: 'Izumi' },
            { fn: () => getVredenVideoByUrl(videoUrl), name: 'Vreden' }
        ];

        // Add ytdl fallback as final attempt if URL is a YouTube link
        apiAttempts.push({ fn: () => getYtdlVideoByUrl(videoUrl), name: 'ytdl' });

        for (const attempt of apiAttempts) {
            try {
                videoData = await attempt.fn();
                if (videoData) break;
            } catch (err) {
                console.warn(`[VIDEO] ${attempt.name} failed: ${err && err.message ? err.message : err}`);
            }
        }

        if (!videoData || !videoData.download) throw new Error('Could not fetch video from any source.');

        // sanitize filename
        function sanitizeFilename(name) {
            if (!name) return 'video';
            return String(name).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 200) || 'video';
        }

        const safeTitle = sanitizeFilename(videoData.title || videoTitle || 'Video');
        const mime = videoData.mime || 'video/mp4';
        const ext = (mime.split('/')[1] || 'mp4').split('+')[0];

        let localFilePath = null;
        let sentViaUrl = false;

        if (videoData.isFile) {
            localFilePath = videoData.download;
        } else {
            // attempt to download remote URL to a temp file for reliable delivery
            try {
                localFilePath = await downloadRemoteToTemp(videoData.download, MAX_DOWNLOAD_BYTES);
            } catch (err) {
                console.warn('[VIDEO] remote download failed:', err && err.message ? err.message : err);
                // fallback to sending remote URL (may fail on some clients)
                sentViaUrl = true;
            }
        }

        if (localFilePath) {
            const stream = fs.createReadStream(localFilePath);
            try {
                await sock.sendMessage(chatId, {
                    video: stream,
                    mimetype: mime,
                    fileName: `${safeTitle}.${ext}`,
                    caption: `*${safeTitle}*\n\n> *Mickey Tanzanite Era* 💎`
                }, { quoted: message });
            } finally {
                try { fs.unlinkSync(localFilePath); } catch (e) {}
            }
        } else if (sentViaUrl) {
            await sock.sendMessage(chatId, {
                video: { url: videoData.download },
                mimetype: mime,
                fileName: `${safeTitle}.${ext}`,
                caption: `*${safeTitle}*\n\n> *Mickey * `
            }, { quoted: message });
        }

    } catch (error) {
        console.error('[VIDEO] Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Error: ' + error.message }, { quoted: message });
    }
}

module.exports = videoCommand;
