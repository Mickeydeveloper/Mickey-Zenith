const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");

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

async function getYupraDownload(youtubeUrl) {
    if (!youtubeUrl || !youtubeUrl.includes('youtu')) {
        throw new Error('Invalid YouTube URL provided to Yupra API');
    }

    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));

    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title || 'Unknown Song',
            thumbnail: res.data.data.thumbnail || null
        };
    }

    throw new Error(
        res?.data?.message ||
        'Yupra API did not return a valid download link (success=false or missing data.download_url)'
    );
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const queryText = text.split(' ').slice(1).join(' ').trim();

        if (!queryText) {
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or YouTube link>' }, { quoted: message });
            return;
        }

        // Immediate reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        let video;
        if (queryText.includes('youtube.com') || queryText.includes('youtu.be')) {
            video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
        } else {
            await sock.sendMessage(chatId, { react: { text: "🔎", key: message.key } }); // Searching
            const search = await yts(queryText);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found for your query.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                return;
            }
            video = search.videos[0];
        }

        // Downloading reaction
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        // Thumbnail
        let thumbnailBuffer;
        try {
            thumbnailBuffer = await getBuffer(video.thumbnail || "https://water-billimg.onrender.com/1761205727440.png");
        } catch {
            thumbnailBuffer = await getBuffer("https://water-billimg.onrender.com/1761205727440.png");
        }

        // Preview message
        await sock.sendMessage(chatId, {
            text: "🎶 *Fetching your song...*",
            contextInfo: {
                externalAdReply: {
                    title: video.title || "Unknown Title",
                    body: `Duration: ${video.timestamp || 'Unknown'} • Mickey Glitch™`,
                    thumbnail: thumbnailBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: video.url || "https://youtube.com"
                }
            }
        }, { quoted: message });

        // Fetch download from Yupra
        const audioData = await getYupraDownload(video.url);

        const audioUrl = audioData.download;
        const title = audioData.title || video.title || 'song';

        if (!audioUrl) {
            throw new Error("No download link received from Yupra API");
        }

        // Download audio as Buffer (key fix for compatibility)
        await sock.sendMessage(chatId, { react: { text: "📥", key: message.key } });
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 90000 });
        const audioBuffer = Buffer.from(audioResponse.data);

        // Sending reaction
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        // Send audio – FIXED with Buffer + audio/mp4
        await sock.sendMessage(chatId, {
            audio: audioBuffer,                        // ← Buffer instead of URL
            mimetype: 'audio/mp4',                     // Most compatible for music-style audio
            fileName: `${title.replace(/[^\w\s-]/g, '')}.m4a`,
            ptt: false,
            waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0]
        }, { quoted: message });

        // Success
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error('Play command error:', err.message || err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download or send the song. Try again later.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = playCommand;