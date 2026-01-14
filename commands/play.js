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

// NOTE: Izumi endpoints removed — using Yupra (Okatsu) API only as primary downloader. If needed later, reintroduce a well-maintained secondary API here.

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    try {
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        // Basic sanity checks
        if (!res || res.status !== 200) throw new Error(`Unexpected status ${res?.status}`);
        if (res?.data?.dl) {
            return {
                download: res.data.dl,
                title: res.data.title || 'Unknown Song',
                thumbnail: res.data.thumb
            };
        }
        throw new Error('Okatsu ytmp3 returned no download');
    } catch (err) {
        // Include the original error message to help debugging
        throw new Error(`Okatsu failed: ${err?.message || err}`);
    }
}

// Last-resort: try to download the audio directly using ytdl-core
const ytdl = require('ytdl-core');

async function getYtdlAudioBuffer(youtubeUrl, maxBytes = 16 * 1024 * 1024) {
    if (!ytdl.validateURL(youtubeUrl)) throw new Error('Invalid YouTube URL');

    const info = await ytdl.getInfo(youtubeUrl);
    const audioFormats = info.formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
    if (!audioFormats.length) throw new Error('No audio formats available');

    // Prefer m4a or webm audio with a reasonable bitrate
    const best = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    const mime = (best.mimeType && best.mimeType.split(';')[0]) || 'audio/mpeg';

    return new Promise((resolve, reject) => {
        const stream = ytdl.downloadFromInfo(info, { quality: best.itag, highWaterMark: 1 << 25 });
        const chunks = [];
        let length = 0;
        stream.on('data', (c) => {
            length += c.length;
            if (length > maxBytes) {
                stream.destroy();
                return reject(new Error(`Direct download exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`));
            }
            chunks.push(c);
        });
        stream.on('end', () => {
            resolve({ buffer: Buffer.concat(chunks), title: info.videoDetails?.title || 'song', mime });
        });
        stream.on('error', (err) => reject(err));
    });
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

        // Try Yupra (Okatsu) API first, then fall back to direct ytdl download if it fails
        let audioData;
        const attempts = [];
        try {
            audioData = await getOkatsuDownloadByUrl(video.url);
            attempts.push('okatsu');
        } catch (e1) {
            attempts.push(`okatsu:${e1?.message || e1}`);
            // Notify user that Yupra failed and we'll attempt a direct download
            await sock.sendMessage(chatId, { text: '⚠️ Yupra API failed. Trying a direct download — this may take longer and can be size-limited.' }, { quoted: message });
            try {
                const ytdlData = await getYtdlAudioBuffer(video.url);
                audioData = { buffer: ytdlData.buffer, title: ytdlData.title || video.title, mime: ytdlData.mime };
                attempts.push('ytdl-direct');
            } catch (e2) {
                attempts.push(`ytdl:${e2?.message || e2}`);
                throw new Error(`No download available. Attempts: ${attempts.join(' | ')}`);
            }
        }

        const audioBuffer = audioData.buffer;
        const audioUrl = audioData.download || audioData.dl || audioData.url;
        const title = audioData.title || video.title || 'song';
        const mimetype = audioData.mimetype || audioData.mime || 'audio/mpeg';

        if (!audioUrl && !audioBuffer) {
            throw new Error("No download link received from any source");
        }

        // Update reaction to sending
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        // Send the audio (buffer from ytdl or URL from API)
        const safeFileName = `${title.replace(/[^\w\s-]/g, '')}.mp3`;
        if (audioBuffer) {
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype,
                fileName: safeFileName,
                ptt: false,
                waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0]
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                audio: { url: audioUrl },
                mimetype,
                fileName: safeFileName,
                ptt: false,
                waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0]
            }, { quoted: message });
        }

        // Final success reaction (no extra "Enjoy" message or second ad)
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error('Play command error:', err);
        const short = err?.message ? ` Reason: ${err.message}` : '';
        await sock.sendMessage(chatId, { text: `❌ Failed to download or send the song.${short} Please try again later.` }, { quoted: message });
        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;
