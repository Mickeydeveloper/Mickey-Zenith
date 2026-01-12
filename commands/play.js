const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");

const AXIOS_CONFIG = {
    timeout: 90000,  // longer because API can be slow
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

const API_BASE = "https://api.vreden.my.id/api/v1/download/play/audio";

async function safeRequest(fn, maxAttempts = 3) {
    let lastErr;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < maxAttempts) {
                await new Promise(r => setTimeout(r, 1200 * i)); // delay increases
            }
        }
    }
    throw lastErr || new Error("API request failed after retries");
}

async function getVredenAudio(query) {
    const url = `\( {API_BASE}?query= \){encodeURIComponent(query)}`;
    console.log("[VREDEN] Fetching:", url);

    const res = await safeRequest(() => axios.get(url, AXIOS_CONFIG));

    console.log("[VREDEN] Status:", res.status);

    if (res.status !== 200) {
        throw new Error(`API returned status ${res.status}`);
    }

    const data = res.data || {};

    // Exact path from working response: result.download.url
    const downloadUrl = data?.result?.download?.url;

    if (!downloadUrl || !downloadUrl.startsWith('http')) {
        console.log("[VREDEN] Raw data snippet:", JSON.stringify(data).slice(0, 400));
        throw new Error("No valid download URL in response (check if .result.download.url exists)");
    }

    const title = data?.result?.metadata?.title || data?.result?.title || "Audio Track";
    const thumbnail = data?.result?.metadata?.thumbnail || data?.result?.thumbnail || null;

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

        const isUrl = /youtube\.com|youtu\.be/.test(query);

        if (isUrl) {
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
        } catch (e) {
            console.log("[THUMB FAIL]", e.message);
            thumbBuffer = await getBuffer("https://i.ytimg.com/vi/default.jpg");
        }

        await sock.sendMessage(chatId, {
            text: "🎶 Preparing your song...",
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

        // ── Try download ───────────────────────────────────────────────
        let audio;
        try {
            audio = await getVredenAudio(videoInfo.url || query);
        } catch (err1) {
            console.log("[VREDEN FAIL URL]", err1.message);
            await new Promise(r => setTimeout(r, 2000));
            try {
                audio = await getVredenAudio(videoInfo.title || query);
            } catch (err2) {
                console.log("[VREDEN FAIL TITLE]", err2.message);
                throw err2;
            }
        }

        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const safeTitle = (audio.title || videoInfo.title || "song")
            .replace(/[^\w\s-]/g, '')
            .trim() || "song";

        await sock.sendMessage(chatId, {
            audio: { url: audio.url },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false,
            waveform: [0, 20, 45, 75, 100, 90, 70, 45, 20, 0]
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.error("[PLAY ERROR]", err.message || err);

        let msg = "❌ Failed to get the audio.\n\n" +
                  "The API sometimes works (like for 'mario oluwa'), but often fails with errors.\n" +
                  "Try again in a few minutes, or use a different song/link.\n" +
                  "Check bot console for details (status code & response).";

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;