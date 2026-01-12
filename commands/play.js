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

const API_BASE = "https://api.vreden.my.id/api/v1/download/play/audio";

async function safeRequest(fn, maxAttempts = 3) {
    let lastErr;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < maxAttempts) {
                await new Promise(r => setTimeout(r, 800 * i));
            }
        }
    }
    throw lastErr;
}

async function fetchAudioData(queryOrUrl) {
    const param = encodeURIComponent(queryOrUrl);
    const urlsToTry = [
        `\( {API_BASE}?query= \){param}&format=mp3`,
        `\( {API_BASE}?query= \){param}`
    ];

    for (const url of urlsToTry) {
        try {
            const res = await safeRequest(() => axios.get(url, AXIOS_CONFIG));

            const data = res?.data;

            // Different APIs return different structures — normalize them
            if (data?.result?.download) {
                return {
                    url: data.result.download,
                    title: data.result.title || "Audio",
                    thumbnail: data.result.thumbnail || data.result.thumb
                };
            }

            if (data?.dl) {
                return {
                    url: data.dl,
                    title: data.title || "Audio",
                    thumbnail: data.thumb
                };
            }

            if (data?.url || data?.download_url) {
                return {
                    url: data.url || data.download_url,
                    title: data.title || "Audio",
                    thumbnail: data.thumb || data.thumbnail
                };
            }
        } catch (_) {
            // silent fail → try next URL
        }
    }

    throw new Error("No valid download link found from API");
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     "";
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: "⚠️  *Usage:*  `.play <song name / YouTube link>`"
            }, { quoted: message });
            return;
        }

        // ── Quick reaction ────────────────────────────────────────
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        // ── Resolve video ─────────────────────────────────────────
        let videoInfo = {
            url: null,
            title: "Unknown Title",
            thumbnail: "https://i.ytimg.com/vi_webp/default.webp",
            timestamp: "??:??"
        };

        const isUrl = query.includes("youtube.com") || query.includes("youtu.be");

        if (isUrl) {
            videoInfo.url = query;
            videoInfo.title = "YouTube Audio";
        } else {
            await sock.sendMessage(chatId, {
                react: { text: "🔎", key: message.key }
            });

            const search = await yts(query);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, {
                    text: "😕 No results found for: *" + query + "*"
                }, { quoted: message });
                await sock.sendMessage(chatId, {
                    react: { text: "❌", key: message.key }
                });
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

        // ── Downloading phase ─────────────────────────────────────
        await sock.sendMessage(chatId, {
            react: { text: "⬇️", key: message.key }
        });

        // ── Get thumbnail buffer (with fallback) ──────────────────
        let thumbBuffer;
        try {
            thumbBuffer = await getBuffer(videoInfo.thumbnail);
        } catch {
            thumbBuffer = await getBuffer("https://i.ytimg.com/vi_webp/default.webp");
        }

        // ── Beautiful preview card ────────────────────────────────
        await sock.sendMessage(chatId, {
            text: "🎧 *Preparing audio...*",
            contextInfo: {
                externalAdReply: {
                    title: videoInfo.title,
                    body: `Duration • ${videoInfo.timestamp}  •  128kbps mp3  •  Mickey Glitch™`,
                    thumbnail: thumbBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: videoInfo.url || "https://youtube.com"
                }
            }
        }, { quoted: message });

        // ── Fetch download link ───────────────────────────────────
        const audio = await fetchAudioData(isUrl ? videoInfo.url : videoInfo.title);

        if (!audio?.url) {
            throw new Error("API did not return a valid download link");
        }

        // ── Sending audio ─────────────────────────────────────────
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const safeTitle = (audio.title || videoInfo.title || "audio")
            .replace(/[^\w\s-]/g, '')
            .trim() || "audio";

        await sock.sendMessage(chatId, {
            audio: { url: audio.url },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false,
            waveform: [5,25,50,80,100,85,65,40,20,5,0]  // nicer wave
        }, { quoted: message });

        // ── Success ───────────────────────────────────────────────
        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.error("[PLAY]", err?.message || err);

        await sock.sendMessage(chatId, {
            text: "❌ Sorry, failed to get the audio.\nTry again or use a different link/query.",
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;