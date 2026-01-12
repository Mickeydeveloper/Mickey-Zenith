const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");

const AXIOS_CONFIG = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

const API_URL = "https://api.vreden.my.id/api/v1/download/play/audio";

async function safeRequest(fn, maxAttempts = 3) {
    let lastErr;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < maxAttempts) await new Promise(r => setTimeout(r, 1000 * i));
        }
    }
    throw lastErr || new Error("API request failed after retries");
}

async function fetchAudioFromVreden(query) {
    const fullUrl = `\( {API_URL}?query= \){encodeURIComponent(query)}`;

    const res = await safeRequest(() => axios.get(fullUrl, AXIOS_CONFIG));

    const data = res.data || {};

    // Try common fields from this API (based on typical responses)
    let downloadUrl = null;
    if (data.result && data.result.download) {
        downloadUrl = data.result.download;
    } else if (data.dl) {
        downloadUrl = data.dl;
    } else if (data.download || data.url || data.link) {
        downloadUrl = data.download || data.url || data.link;
    }

    const title = data.result?.title || data.title || "Audio Track";
    const thumbnail = data.result?.thumbnail || data.thumb || data.thumbnail || null;

    if (!downloadUrl || !downloadUrl.startsWith('http')) {
        throw new Error(`No valid download link in API response. Got: ${JSON.stringify(data)}`);
    }

    return {
        url: downloadUrl,
        title,
        thumbnail
    };
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text || "";
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: "⚠️ Usage: `.play <song name or YouTube link>`"
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        let videoInfo = {
            url: null,
            title: "Unknown Title",
            thumbnail: "https://i.ytimg.com/vi/default.jpg",
            timestamp: "??:??"
        };

        const isYouTubeLink = /youtube\.com|youtu\.be/.test(query);

        if (isYouTubeLink) {
            videoInfo.url = query.startsWith('http') ? query : `https://${query}`;
            videoInfo.title = "YouTube Audio";
        } else {
            await sock.sendMessage(chatId, {
                react: { text: "🔎", key: message.key }
            });

            const search = await yts(query);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, {
                    text: `❌ No results found for "${query}"`
                }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                return;
            }

            const vid = search.videos[0];
            videoInfo = {
                url: vid.url,
                title: vid.title,
                thumbnail: vid.thumbnail,
                timestamp: vid.timestamp || "??:??"
            };
        }

        await sock.sendMessage(chatId, {
            react: { text: "⬇️", key: message.key }
        });

        let thumbBuffer;
        try {
            thumbBuffer = await getBuffer(videoInfo.thumbnail);
        } catch {
            thumbBuffer = await getBuffer("https://i.ytimg.com/vi/default.jpg");
        }

        await sock.sendMessage(chatId, {
            text: "🎶 Preparing audio...",
            contextInfo: {
                externalAdReply: {
                    title: videoInfo.title,
                    body: `Duration: ${videoInfo.timestamp} • MP3`,
                    thumbnail: thumbBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: videoInfo.url || "https://youtube.com"
                }
            }
        }, { quoted: message });

        // Use only vreden API - try link first, then title as fallback
        let audioData;
        try {
            audioData = await fetchAudioFromVreden(videoInfo.url || query);
        } catch (e) {
            // Fallback to song title / search query if link fails
            console.log("[VREDEN] Link attempt failed, trying query:", e.message);
            audioData = await fetchAudioFromVreden(videoInfo.title || query);
        }

        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const safeTitle = (audioData.title || videoInfo.title || "track")
            .replace(/[^\w\s-]/g, '')
            .trim() || "track";

        await sock.sendMessage(chatId, {
            audio: { url: audioData.url },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false,
            waveform: [0, 20, 45, 75, 100, 90, 70, 45, 20, 0]
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.error("[PLAY ERROR]", err?.message || err);

        let errorMsg = "❌ Failed to get audio.\n\nThe API (api.vreden.my.id) returned an error or no link.\nTry again later — it seems unstable right now (often 500/503 errors).";

        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;