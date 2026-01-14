const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { getBuffer } = require('../lib/myfunc');
const { toAudio } = require('../lib/converter');

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
    // Support multiple possible Yupra response shapes
    // Newer shape: { success: true, data: { download_url, title, thumbnail } }
    if (res?.data?.success && res?.data?.data?.download_url) {
      return {
        download: res.data.data.download_url,
        title: res.data.data.title || 'Unknown Song',
        thumbnail: res.data.data.thumbnail
      };
    }
    // Legacy shape: { dl, title, thumb }
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
      // If the user provided a URL, try to resolve metadata (title/thumbnail) via yt-search
      try {
        const directSearch = await yts(queryText);
        if (directSearch && Array.isArray(directSearch.videos) && directSearch.videos.length) {
          video = directSearch.videos[0];
        } else {
          video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
        }
      } catch (e) {
        video = { url: queryText, title: 'YouTube Video', timestamp: 'Loading...' };
      }
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

    // Inform the user and send the selected YouTube URL to Yupra automatically
    try {
      if (video && video.url) {
        await sock.sendMessage(chatId, { text: `🔎 Found: ${video.title}\n🔗 ${video.url}\n➡️ Sending to Yupra API...` }, { quoted: message });
      }
    } catch (e) {
      console.error('Failed to notify user of selected video:', e);
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

    // Use Yupra API to get download link, fallback to Okatsu if it fails
    let audioData;
    try {
      audioData = await getYupraDownloadByUrl(video.url);
    } catch (e1) {
      console.warn('Yupra failed, trying Okatsu:', e1?.message || e1);
      try {
        // Okatsu fallback
        const okatsuApi = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
        const resOk = await tryRequest(() => axios.get(okatsuApi, AXIOS_DEFAULTS));
        if (resOk?.data?.dl) {
          audioData = { download: resOk.data.dl, title: resOk.data.title, thumbnail: resOk.data.thumb };
        } else {
          throw new Error('Okatsu returned no download');
        }
      } catch (e2) {
        console.error('Yupra+Okatsu download error:', e1, e2);
        await sock.sendMessage(chatId, { text: `❌ Failed to get download from Yupra and Okatsu. ${e2?.message || ''}` }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return;
      }
    }

    const audioUrl = audioData.download || audioData.dl || audioData.url;
    const title = audioData.title || video.title || 'song';

    if (!audioUrl) {
      await sock.sendMessage(chatId, { text: '❌ No usable download URL returned by the API.' }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    // Update reaction to sending
    await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

    // Download audio to buffer
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
          Accept: '*/*',
          'Accept-Encoding': 'identity'
        }
      });
      audioBuffer = Buffer.from(audioResponse.data);
    } catch (e1) {
      // Fallback: use stream mode
      try {
        const audioResponse = await axios.get(audioUrl, {
          responseType: 'stream',
          timeout: 90000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: s => s >= 200 && s < 400,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
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
      } catch (e2) {
        console.error('Failed to download audio:', e1, e2);
        await sock.sendMessage(chatId, { text: '❌ Failed to download audio from the provided URL.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return;
      }
    }

    // Validate buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      await sock.sendMessage(chatId, { text: '❌ Downloaded audio is empty.' }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    // Detect actual file format from signature
    const firstBytes = audioBuffer.slice(0, 12);
    const hexSignature = firstBytes.toString('hex');
    const asciiSignature = firstBytes.toString('ascii', 4, 8);

    let actualMimetype = 'audio/mpeg';
    let fileExtension = 'mp3';
    let detectedFormat = 'unknown';

    if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
      const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
      if (ftypBox === 'ftyp') {
        detectedFormat = 'M4A/MP4';
        actualMimetype = 'audio/mp4';
        fileExtension = 'm4a';
      }
    } else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' || (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
      detectedFormat = 'MP3';
      actualMimetype = 'audio/mpeg';
      fileExtension = 'mp3';
    } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
      detectedFormat = 'OGG/Opus';
      actualMimetype = 'audio/ogg; codecs=opus';
      fileExtension = 'ogg';
    } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
      detectedFormat = 'WAV';
      actualMimetype = 'audio/wav';
      fileExtension = 'wav';
    } else {
      actualMimetype = 'audio/mp4';
      fileExtension = 'm4a';
      detectedFormat = 'Unknown (defaulting to M4A)';
    }

    // Convert to MP3 if needed
    let finalBuffer = audioBuffer;
    let finalMimetype = 'audio/mpeg';
    let finalExtension = 'mp3';

    if (fileExtension !== 'mp3') {
      try {
        finalBuffer = await toAudio(audioBuffer, fileExtension);
        if (!finalBuffer || finalBuffer.length === 0) throw new Error('Conversion returned empty buffer');
        finalMimetype = 'audio/mpeg';
        finalExtension = 'mp3';
      } catch (convErr) {
        console.error('Conversion failed:', convErr);
        await sock.sendMessage(chatId, { text: `❌ Failed to convert ${detectedFormat} to MP3: ${convErr?.message || ''}` }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return;
      }
    }

    // Send buffer as MP3
    try {
      await sock.sendMessage(chatId, {
        audio: finalBuffer,
        mimetype: finalMimetype,
        fileName: `${(audioData.title || video.title || 'song')}.${finalExtension}`,
        ptt: false
      }, { quoted: message });
    } catch (sendErr) {
      console.error('Failed to send final audio buffer:', sendErr);
      await sock.sendMessage(chatId, { text: '❌ Failed to send the converted audio.' }, { quoted: message });
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      return;
    }

    // Cleanup temp files older than 10s in ../temp
    try {
      const tempDir = path.join(__dirname, '../temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 10000) {
              if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                try { fs.unlinkSync(filePath); } catch (_) {}
              }
            }
          } catch (e) {}
        });
      }
    } catch (cleanupErr) {
      // ignore
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