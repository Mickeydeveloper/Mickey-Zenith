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



async function getIzumiVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.izumi.my.id/api/download/video?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.url) {
        return { download: res.data.url, title: res.data.title || 'Video' };
    }
    throw new Error('Izumi API returned no download URL');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.vreden.my.id/api/v1/download/play/video?query=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { status, creator, url, result: { status, title, mp4 } }
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu ytmp4 returned no mp4');
}

async function getYoutubeAPIVideoByUrl(youtubeUrl) {
    const apiUrl = `https://youtube-api.vercel.app/api/video?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.download?.url) {
        return { download: res.data.download.url, title: res.data.title || 'Video' };
    }
    throw new Error('YouTube API returned no download URL');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
            return;
        }

        // Determine if input is a YouTube link
        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            // Search YouTube for the video
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            const captionTitle = videoTitle || searchQuery;
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${captionTitle}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) { console.error('[VIDEO] thumb error:', e?.message || e); }
        

        // Validate YouTube URL
        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Get video: try multiple APIs with fallback
        let videoData;
        const apiAttempts = [
            { fn: () => getIzumiVideoByUrl(videoUrl), name: 'Izumi' },
            { fn: () => getYoutubeAPIVideoByUrl(videoUrl), name: 'YouTube API' },
            { fn: () => getOkatsuVideoByUrl(videoUrl), name: 'Okatsu' }
        ];
        
        let lastError;
        for (const attempt of apiAttempts) {
            try {
                console.log(`[VIDEO] Attempting download with ${attempt.name}...`);
                videoData = await attempt.fn();
                console.log(`[VIDEO] Successfully downloaded with ${attempt.name}`);
                break;
            } catch (err) {
                lastError = err;
                console.warn(`[VIDEO] ${attempt.name} failed:`, err?.message || err);
            }
        }
        
        if (!videoData) {
            throw new Error(`All download APIs failed. Last error: ${lastError?.message || 'Unknown'}`);
        }

        // Send video directly using the download URL
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title || videoTitle || 'video'}.mp4`,
            caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *_Downloaded from Mickey Database_*`
        }, { quoted: message });


    } catch (error) {
        console.error('[VIDEO] Command Error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Download failed: ' + (error?.message || 'Unknown error') }, { quoted: message });
    }
}

module.exports = videoCommand; 