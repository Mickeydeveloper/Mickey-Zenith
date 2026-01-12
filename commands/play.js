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

async function getIzumiDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi youtube?url returned no download');
}

async function getIzumiDownloadByQuery(query) {
    const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi youtube-play returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.vreden.my.id/api/v1/download/play/audio?query=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title || 'Unknown Song',
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const queryText = text.split(' ').slice(1).join(' ').trim();

        if (!queryText) {
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or YouTube link>' }, { quoted: message });
            return;
        }

        // Immediate reaction when command is used
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

        // Update reaction to downloading
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        // Get thumbnail buffer
        let thumbnailBuffer;
        try {
            thumbnailBuffer = await getBuffer(video.thumbnail || "https://water-billimg.onrender.com/1761205727440.png");
        } catch (e) {
            thumbnailBuffer = await getBuffer("https://water-billimg.onrender.com/1761205727440.png"); // fallback
        }

        // Send beautiful ad preview with song info (this is the only ad now)
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

        // Get download link with fallbacks
        let audioData;
        try {
            audioData = await getIzumiDownloadByUrl(video.url);
        } catch (e1) {
            try {
                audioData = await getIzumiDownloadByQuery(video.title || queryText);
            } catch (e2) {
                audioData = await getOkatsuDownloadByUrl(video.url);
            }
        }

        const audioUrl = audioData.download || audioData.dl || audioData.url;
        const title = audioData.title || video.title || 'song';

        if (!audioUrl) {
            throw new Error("No download link received from any API");
        }

        // Update reaction to sending
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        // Send the audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title.replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false,
            waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0] // Optional: visual waveform
        }, { quoted: message });

        // Final success reaction (no extra "Enjoy" message or second ad)
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error('Play command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download or send the song. Please try again later.' }, { quoted: message });
        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;