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

function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function safeRequest(fn, maxAttempts = 3) {
    let lastErr;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < maxAttempts) await new Promise(r => setTimeout(r, 800 * i));
        }
    }
    throw lastErr || new Error("All request attempts failed");
}

async function fetchAudioData(videoUrl, fallbackTitle) {
    const videoId = extractVideoId(videoUrl);
    if (!videoId && !videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        // If not URL, treat as search query fallback
        throw new Error("Invalid YouTube URL for direct download");
    }

    const sources = [
        // Primary: MatheusIshiyama repl.co API (active in recent GitHub mentions)
        `https://youtube-download-api.matheusishiyama.repl.co/download?format=mp3&url=${encodeURIComponent(videoUrl)}`,

        // Fallback: Vevioz-style direct (some instances expose JSON)
        `https://api.vevioz.com/@api/button/mp3/${videoId}`,

        // Another mirror style from GitHub topics (adjust if needed)
        `https://youtube-download-api.matheusishiyama.repl.co/mp3?id=${videoId}`
    ];

    for (const apiUrl of sources) {
        try {
            const res = await safeRequest(() => axios.get(apiUrl, AXIOS_CONFIG));
            const data = res.data;

            // Normalize different response formats
            let downloadUrl = data.url || data.download || data.link || data.mp3 || data.audio || null;
            let songTitle   = data.title || data.videoTitle || fallbackTitle || "Audio Track";
            let thumb       = data.thumbnail || data.thumb || data.image || null;

            // Some return direct redirect or stream URL
            if (typeof data === 'string' && data.startsWith('http') && data.includes('.mp3')) {
                downloadUrl = data;
            }

            if (downloadUrl && (downloadUrl.startsWith('http') || downloadUrl.includes('.mp3'))) {
                return {
                    url: downloadUrl,
                    title: songTitle,
                    thumbnail: thumb
                };
            }
        } catch (e) {
            console.log(`[AUDIO SOURCE FAIL] ${apiUrl} → ${e.message || e}`);
            // continue to next
        }
    }

    throw new Error("No valid MP3 download link from available sources (APIs may be temporary)");
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
                    sourceUrl: videoInfo.url
                }
            }
        }, { quoted: message });

        const audio = await fetchAudioData(videoInfo.url, videoInfo.title);

        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const safeTitle = (audio.title || videoInfo.title || "track")
            .replace(/[^\w\s-]/g, '')
            .trim() || "track";

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
        console.error("[PLAY ERROR]", err?.message || err?.stack || err);

        await sock.sendMessage(chatId, {
            text: "❌ Failed to get audio right now.\nThe public converters can be unstable — try again in a few minutes or use a different song/link.",
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;