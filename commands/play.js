const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 4) {  // increased attempts
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
    throw lastError;
}

async function getYupraDownload(youtubeUrl) {
    if (!youtubeUrl || !youtubeUrl.includes('youtu')) {
        throw new Error('Invalid YouTube URL');
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

    throw new Error(res?.data?.message || 'No valid download link from API');
}

async function convertToOpus(buffer) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const inputStream = Readable.from(buffer);

        ffmpeg(inputStream)
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(48000)
            .audioBitrate(64)
            .format('ogg')
            .on('error', (err) => reject(new Error(`FFmpeg: ${err.message}`)))
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
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or link>' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        let video;
        if (queryText.includes('youtube.com') || queryText.includes('youtu.be')) {
            video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
        } else {
            await sock.sendMessage(chatId, { react: { text: "🔎", key: message.key } });
            const search = await yts(queryText);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
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

        if (!audioUrl) throw new Error("No download link");

        // Quick check if link is alive
        try {
            await axios.head(audioUrl, { timeout: 10000 });
        } catch (e) {
            throw new Error(`Download link invalid/expired (${e.message})`);
        }

        await sock.sendMessage(chatId, { react: { text: "📥", key: message.key } });

        // Improved download
        const audioResponse = await tryRequest(() => axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 
                'User-Agent': AXIOS_DEFAULTS.headers['User-Agent'],
                'Referer': 'https://youtube.com/'
            }
        }));

        const audioBuffer = Buffer.from(audioResponse.data);

        await sock.sendMessage(chatId, { react: { text: "🔄", key: message.key } });
        const opusBuffer = await convertToOpus(audioBuffer);

        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

        await sock.sendMessage(chatId, {
            audio: opusBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            fileName: `${title.replace(/[^\w\s-]/g, '')}.ogg`,
            waveform: [0, 20, 40, 60, 80, 100, 80, 60, 40, 20, 0, 30, 50, 70, 90]
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error('Play command FULL error:', {
            message: err.message,
            stack: err.stack?.substring(0, 300),
            code: err.code,
            response: err.response ? { status: err.response.status, data: err.response.data } : null
        });
        await sock.sendMessage(chatId, { 
            text: `❌ Failed: ${err.message || 'Unknown issue'}\nTry another song or check later.` 
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = songCommand; 