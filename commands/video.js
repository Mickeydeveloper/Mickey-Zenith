const axios = require('axios');
const yts = require('yt-search');

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
    const apiUrl = `https://api.izumi.my.id/api/download/video?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    const best = extractBestVideo(res.data);
    if (best) return { download: best.url, title: res.data.title || 'Video', mime: best.type || 'video/mp4' };
    throw new Error('Izumi API failed');
}

async function getVredenVideoByUrl(youtubeUrl) {
    // Vreden usually supports multiple formats
    const apiUrl = `https://api.vreden.my.id/api/v1/download/play/video?query=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    const result = res.data.result;
    // Check for high res first, fallback to standard mp4
    const downloadUrl = result.video_hd || result.video_sd || result.mp4;
    if (downloadUrl) {
        return { download: downloadUrl, title: result.title, mime: 'video/mp4' };
    }
    throw new Error('Vreden API failed');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

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
        const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
        const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg` : undefined);
        
        await sock.sendMessage(chatId, {
            image: { url: thumb },
            caption: `*Mickey Tanzanite Era* 💎\n\n*Title:* ${videoTitle || 'Searching...'}\n*Status:* Fetching best quality...`
        }, { quoted: message });

        // API Fallback Chain
        let videoData;
        const apiAttempts = [
            { fn: () => getIzumiVideoByUrl(videoUrl), name: 'Izumi' },
            { fn: () => getVredenVideoByUrl(videoUrl), name: 'Vreden/Okatsu' }
        ];

        for (const attempt of apiAttempts) {
            try {
                videoData = await attempt.fn();
                if (videoData) break;
            } catch (err) {
                console.warn(`[VIDEO] ${attempt.name} failed`);
            }
        }

        if (!videoData) throw new Error("Could not fetch video from any source.");

        // Send the Video
        // The dynamic 'mimetype' ensures if the API returns a WebM or MKV, it still sends.
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: videoData.mime || 'video/mp4',
            fileName: `${videoData.title}.mp4`,
            caption: `*${videoData.title}*\n\n> *Mickey Tanzanite Era* 💎`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO] Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Error: ' + error.message }, { quoted: message });
    }
}

module.exports = videoCommand;
