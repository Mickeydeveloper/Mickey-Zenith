const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegInstaller.path); // Auto-set ffmpeg path

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

async function convertToOpus(buffer) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const inputStream = Readable.from(buffer);

        ffmpeg(inputStream)
            .audioCodec('libopus')
            .audioChannels(1)          // Mono (WhatsApp voice notes require mono)
            .audioFrequency(48000)     // Standard for Opus in WhatsApp
            .audioBitrate(64)          // Good quality + small size
            .format('ogg')
            .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe();
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

        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        let video;
        if (queryText.includes('youtube.com') || queryText.includes('youtu.be')) {
            video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
        } else {
            await sock.sendMessage(chatId, { react: { text: "🔎", key: message.key } });
            const search = await yts(queryText);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found for your query.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                return;
            }
            video = search.videos[0];
        }

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        let thumbnailBuffer;
        try {
            thumbnailBuffer = await getBuffer(video.thumbnail || "https://water-billimg.onrender.com/1761205727440.png");
        } catch {
            thumbnailBuffer = await getBuffer("https://water-billimg.onrender.com/1761205727440.png");
        }

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

        const audioData = await getYupraDownload(video.url);
        const audioUrl = audioData.download;
        const title = audioData.title || video.title || 'song';

        if (!audioUrl) {
            throw new Error("No download link received from Yupra API");
        }

        await sock.sendMessage(chatId, { react: { text: "📥", key: message.key } });

        // Download original audio
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 90000 });
        const mp3Buffer = Buffer.from(audioResponse.data);

        // Convert to Opus/OGG
        await sock.sendMessage(chatId, { react: { text: "🔄", key: message.key } });
        const opusBuffer = await convertToOpus(mp3Buffer);

        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        // Send as voice note (ptt: true) – this fixes the error
        await sock.sendMessage(chatId, {
            audio: opusBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,                                 // ← Key: makes it a voice note
            fileName: `${title.replace(/[^\w\s-]/g, '')}.ogg`,
            waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0, 30, 50, 70, 90] // Longer waveform looks better
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error('Play command error:', err.message || err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download, convert or send the song. Try again later.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = playCommand;