const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require('../lib/myfunc');

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*'
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

async function getYupraDownloadByUrl(youtubeUrl) {
  if (!youtubeUrl) throw new Error('No YouTube URL provided');
  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  try {
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (!res || res.status !== 200) throw new Error(`HTTP ${res?.status || 'unknown'}`);
    // Yupra returns { dl, title, thumb } on success
    if (res?.data?.dl) {
      return {
        download: res.data.dl,
        title: res.data.title || 'Unknown Song',
        thumbnail: res.data.thumb
      };
    }
    throw new Error('Yupra returned no download');
  } catch (err) {
    throw new Error(`Yupra failed: ${err?.message || err}`);
  }
}

async function playCommand(sock, chatId, message) {
  try {
    const text =
      message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const queryText = text.split(' ').slice(1).join(' ').trim();

    if (!queryText) {
      await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or YouTube link>' }, { quoted: message });
      return;
    }

    // Quick reaction
    await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

    let video;
    if (queryText.includes('youtube.com') || queryText.includes('youtu.be')) {
      video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
    } else {
      await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });
      const search = await yts(queryText);
      if (!search || !Array.isArray(search.videos) || !search.videos.length) {
        await sock.sendMessage(chatId, { text: '❌ No results found for your query.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return;
      }
      video = search.videos[0];
    }

    // Update reaction to downloading
    await sock.sendMessage(chatId, { react: { text: '⬇️', key: message.key } });

    // Try to fetch a thumbnail (fallback to hosted image)
    let thumbnailBuffer;
    try {
      thumbnailBuffer = await getBuffer(video.thumbnail || 'https://water-billimg.onrender.com/1761205727440.png');
    } catch (e) {
      thumbnailBuffer = await getBuffer('https://water-billimg.onrender.com/1761205727440.png');
    }

    // Send preview
    await sock.sendMessage(
      chatId,
      {
        text: '🎶 *Fetching your song...*',
        contextInfo: {
          externalAdReply: {
            title: video.title || 'Unknown Title',
            body: `Duration: ${video.timestamp || 'Unknown'} • Mickey Glitch™`,
            thumbnail: thumbnailBuffer,
            mediaType: 1,
            renderLargerThumbnail: true,
            sourceUrl: video.url || 'https://youtube.com'
          }
        }
      },
      { quoted: message }
    );

    // Use Yupra API to get download link
    let audioData;
    try {
      audioData = await getYupraDownloadByUrl(video.url);
    } catch (err) {
      console.error('Yupra download error:', err);
      await sock.sendMessage(chatId, { text: `❌ Failed to get download from Yupra. ${err?.message || ''}` }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    const audioUrl = audioData.download || audioData.dl || audioData.url;
    const title = audioData.title || video.title || 'song';

    if (!audioUrl) {
      await sock.sendMessage(chatId, { text: '❌ Yupra returned no usable download URL.' }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    // Update reaction to sending
    await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

    // Send audio by URL
    const safeFileName = `${title.replace(/[^\w\s-]/g, '')}.mp3`;
    try {
      await sock.sendMessage(chatId, {
        audio: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: safeFileName,
        ptt: false
      }, { quoted: message });
    } catch (eSend) {
      console.error('Send audio by URL failed:', eSend);
      // Inform user and abort
      await sock.sendMessage(chatId, { text: '❌ Failed to send audio from URL. The file may be unavailable or blocked. Trying a fallback is possible.' }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    // Final success reaction
    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
  } catch (err) {
    console.error('Play command error:', err);
    await sock.sendMessage(chatId, { text: `❌ Failed to download or send the song. ${err?.message || ''}` }, { quoted: message });
    await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
  }
}

module.exports = playCommand;