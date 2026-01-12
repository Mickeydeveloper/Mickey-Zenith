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

async function safeRequest(fn, maxAttempts = 3) {
    let lastErr;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < maxAttempts) await new Promise(r => setTimeout(r, 700 * i));
        }
    }
    throw lastErr || new Error("Request failed after retries");
}

async function fetchAudioData(videoUrl, titleForFallback) {
    const sources = [
        // Primary: convert2mp3s.com (simple & working in recent checks)
        `https://convert2mp3s.com/api/single/mp3?url=${encodeURIComponent(videoUrl)}`,

        // Fallback mirror style (some public proxies use similar endpoints)
        `https://convert2mp3s.com/api/button/mp3?url=${encodeURIComponent(videoUrl)}`
    ];

    for (const apiUrl of sources) {
        try {
            const res = await safeRequest(() => axios.get(apiUrl, AXIOS_CONFIG));
            const data = res.data;

            // Many of these APIs return { url: "...", title: "...", ... } or similar
            let downloadUrl = data.url || data.download || data.link || null;
            let songTitle   = data.title || titleForFallback || "Audio";
            let thumb       = data.thumbnail || data.thumb || null;

            if (downloadUrl && downloadUrl.startsWith('http')) {
                return {
                    url: downloadUrl,
                    title: songTitle,
                    thumbnail: thumb
                };
            }
        } catch (e) {
            // silent → try next source
            console.log(`[AUDIO] Source failed: ${apiUrl} → ${e.message}`);
        }
    }

    throw new Error("No working audio download link found from available sources");
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
            videoInfo.title = "YouTube Track";
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

        // Clean preview – no ads
        await sock.sendMessage(chatId, {
            text: "🎶 Preparing your audio...",
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

        // Fetch the direct mp3 link
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
            waveform: [0, 15, 35, 60, 90, 100, 85, 60, 35, 15, 0]
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.error("[PLAY ERROR]", err?.message || err);

        await sock.sendMessage(chatId, {
            text: "❌ Could not fetch the audio.\nThe link might be invalid, or try a different song/query later.",
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;