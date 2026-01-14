const axios = require('axios');
const yts = require('yt-search');

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

async function getYupraAudioByUrl(youtubeUrl) {
    // Craft a clear instruction/prompt so the AI understands it's supposed to act as a downloader
    const prompt = `Download this YouTube video as high-quality MP3 audio and give me only the direct download link (nothing else in the response): ${youtubeUrl}`;

    const apiUrl = `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(prompt)}`;

    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));

    let responseText = res?.data?.response || res?.data?.result || res?.data?.text || '';

    // Try to extract a clean URL from whatever the AI returns
    // This is brittle — adjust regex/pattern based on actual AI output format
    const urlMatch = responseText.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch && urlMatch[1].endsWith('.mp3')) {
        return {
            download: urlMatch[1],
            title: 'AI Downloaded Audio'  // fallback title; ideally extract from search
        };
    }

    // If no clean MP3 link found, you could try more parsing logic here
    // e.g. look for patterns like "link: https://..." or JSON in response

    throw new Error('Yupra AI did not return a valid MP3 download link. Raw response: ' + responseText.slice(0, 200));
}

async function playCommand(sock, chatId, message) {
    try {
        const raw = message.message?.conversation?.trim() || 
                    message.message?.extendedTextMessage?.text?.trim() || '';
        const args = raw.split(/\s+/).slice(1).join(' ').trim();

        if (!args) {
            await sock.sendMessage(chatId, { text: 'Usage: .play <YouTube link or search terms>' }, { quoted: message });
            return;
        }

        let input = args;
        let title = '';
        let thumbnail = '';

        if (!input.startsWith('http://') && !input.startsWith('https://')) {
            const { videos } = await yts(input);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No results found for your query.' }, { quoted: message });
                return;
            }
            input = videos[0].url;
            title = videos[0].title;
            thumbnail = videos[0].thumbnail;
        }

        // Send preview/info while "downloading"
        try {
            const captionTitle = title || input;
            if (thumbnail) {
                await sock.sendMessage(chatId, { 
                    image: { url: thumbnail }, 
                    caption: `*${captionTitle}*\nFetching audio via AI...` 
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: `Fetching audio for: ${captionTitle}` }, { quoted: message });
            }
        } catch (e) { 
            console.error('[PLAY] thumb/info error:', e?.message || e); 
        }

        // Basic YouTube URL validation
        const urls = input.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Try the new AI-based downloader
        const audioData = await getYupraAudioByUrl(input);

        const fileName = (title || audioData.title || 'audio').replace(/[\\/:*?"<>|]/g, '').trim() + '.mp3';

        await sock.sendMessage(chatId, {
            audio: { url: audioData.download },
            mimetype: 'audio/mpeg',
            fileName
        }, { quoted: message });

    } catch (error) {
        console.error('[PLAY] Command Error:', error?.message || error);
        await sock.sendMessage(chatId, { 
            text: 'Audio fetch failed: ' + (error?.message || 'Unknown error') 
        }, { quoted: message });
    }
}

module.exports = playCommand;
