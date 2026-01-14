const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');

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

async function getYupraDownloadByUrl(youtubeUrl) {
        const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        if (res?.data?.success && res?.data?.data?.download_url) {
                return {
                        download: res.data.data.download_url,
                        title: res.data.data.title,
                        thumbnail: res.data.data.thumbnail
                };
        }
        throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        // Okatsu response shape: { status, creator, title, format, thumb, duration, cached, dl }
        if (res?.data?.dl) {
                return {
                        download: res.data.dl,
                        title: res.data.title,
                        thumbnail: res.data.thumb
                };
        }
        throw new Error('Okatsu ytmp3 returned no download');
}

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
                        video = { url: text };
        } else {
                        const search = await yts(text);
                        if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
                return;
            }
                        video = search.videos[0];
        }

        // Inform user
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp}`
        }, { quoted: message });

                // Try Yupra primary, then Okatsu fallback
                let audioData;
                try {
                        // 1) Primary: Yupra by youtube url
                        audioData = await getYupraDownloadByUrl(video.url);
                } catch (e1) {
                        // 2) Fallback: Okatsu by youtube url
                        audioData = await getOkatsuDownloadByUrl(video.url);
                }

                const audioUrl = audioData.download || audioData.dl || audioData.url;

                // Download audio to buffer - try arraybuffer first, fallback to stream
                let audioBuffer;
                try {
                        const audioResponse = await axios.get(audioUrl, {
                                responseType: 'arraybuffer',
                                timeout: 90000,
                                maxContentLength: Infinity,
                                maxBodyLength: Infinity,
                                decompress: true,
                                validateStatus: s => s >= 200 && s < 400,
                                headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        'Accept': '*/*',
                                        'Accept-Encoding': 'identity' // Disable compression to avoid corruption
                                }
                        });
                        audioBuffer = Buffer.from(audioResponse.data);
                } catch (e1) {
                        // Fallback: use stream mode
                        const audioResponse = await axios.get(audioUrl, {
                                responseType: 'stream',
                                timeout: 90000,
                                maxContentLength: Infinity,
                                maxBodyLength: Infinity,
                                validateStatus: s => s >= 200 && s < 400,
                                headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        'Accept': '*/*',
                                        'Accept-Encoding': 'identity'
                                }
                        });
                        const chunks = [];
                        await new Promise((resolve, reject) => {
                                audioResponse.data.on('data', c => chunks.push(c));
                                audioResponse.data.on('end', resolve);
                                audioResponse.data.on('error', reject);
                        });
                        audioBuffer = Buffer.concat(chunks);
                }

                // Validate buffer
                if (!audioBuffer || audioBuffer.length === 0) {
                        throw new Error('Downloaded audio buffer is empty');
                }

                // Detect actual file format from signature
                const firstBytes = audioBuffer.slice(0, 12);
                const hexSignature = firstBytes.toString('hex');
                const asciiSignature = firstBytes.toString('ascii', 4, 8);

                let actualMimetype = 'audio/mpeg';
                let fileExtension = 'mp3';
                let detectedFormat = 'unknown';

                // Check for MP4/M4A (ftyp box)
                if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
                        // Check if it's M4A (audio/mp4)
                        const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
                        if (ftypBox === 'ftyp') {
                                detectedFormat = 'M4A/MP4';
                                actualMimetype = 'audio/mp4';
                                fileExtension = 'm4a';
                        }
                }
                // Check for MP3 (ID3 tag or MPEG frame sync)
                else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' || 
                         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
                        detectedFormat = 'MP3';
                        actualMimetype = 'audio/mpeg';
                        fileExtension = 'mp3';
                }
                // Check for OGG/Opus
                else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
                        detectedFormat = 'OGG/Opus';
                        actualMimetype = 'audio/ogg; codecs=opus';
                        fileExtension = 'ogg';
                }
                // Check for WAV
                else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
                        detectedFormat = 'WAV';
                        actualMimetype = 'audio/wav';
                        fileExtension = 'wav';
                }
                else {
                        // Default to M4A since that's what the signature often suggests
                        actualMimetype = 'audio/mp4';
                        fileExtension = 'm4a';
                        detectedFormat = 'Unknown (defaulting to M4A)';
                }

                // Convert to MP3 if not already MP3
                let finalBuffer = audioBuffer;
                let finalMimetype = 'audio/mpeg';
                let finalExtension = 'mp3';

                if (fileExtension !== 'mp3') {
                        try {
                                finalBuffer = await toAudio(audioBuffer, fileExtension);
                                if (!finalBuffer || finalBuffer.length === 0) {
                                        throw new Error('Conversion returned empty buffer');
                                }
                                finalMimetype = 'audio/mpeg';
                                finalExtension = 'mp3';
                        } catch (convErr) {
                                throw new Error(`Failed to convert ${detectedFormat} to MP3: ${convErr.message}`);
                        }
                }

                // Send buffer as MP3
                await sock.sendMessage(chatId, {
                        audio: finalBuffer,
                        mimetype: finalMimetype,
                        fileName: `${(audioData.title || video.title || 'song')}.${finalExtension}`,
                        ptt: false
                }, { quoted: message });

                // Cleanup: Delete temp files created during conversion
                try {
                        const tempDir = path.join(__dirname, '../temp');
                        if (fs.existsSync(tempDir)) {
                                const files = fs.readdirSync(tempDir);
                                const now = Date.now();
                                files.forEach(file => {
                                        const filePath = path.join(tempDir, file);
                                        try {
                                                const stats = fs.statSync(filePath);
                                                // Delete temp files older than 10 seconds (conversion temp files)
                                                if (now - stats.mtimeMs > 10000) {
                                                        // Check if it's a temp audio file (mp3, m4a, or numeric timestamp files from converter)
                                                        if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                                                                fs.unlinkSync(filePath);
                                                        }
                                                }
                                        } catch (e) {
                                                // Ignore individual file errors
                                        }
                                });
                        }
                } catch (cleanupErr) {
                        // Ignore cleanup errors
                }

    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download song.' }, { quoted: message });
    }
}

module.exports = songCommand;