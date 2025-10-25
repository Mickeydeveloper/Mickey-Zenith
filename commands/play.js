import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import axiosRetry from 'axios-retry';
import { OWNER_NAME } from '../config.js';

const API_KEY = "AIzaSyDV11sdmCCdyyToNU-XRFMbKgAA4IEDOS0";
const FASTAPI_URL = "https://api.danscot.tech";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

// Configure axios retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

/**
 * Extracts the search query from the message body (after command)
 */
const extractQuery = (body) => {
  const words = body.trim().split(/\s+/);
  return words.length > 1 ? words.slice(1).join(' ') : null;
};

/**
 * Searches YouTube for the first video matching the query
 */
const searchYouTubeVideo = async (query) => {
  const { data } = await axios.get(YOUTUBE_SEARCH_URL, {
    params: {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: 1,
      key: API_KEY,
    },
  });

  if (!data.items?.length) {
    throw new Error('No video found for the given title.');
  }

  const video = data.items[0];
  return {
    id: video.id.videoId,
    title: video.snippet.title,
    url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
  };
};

/**
 * Downloads MP3 from FastAPI backend
 */
const downloadMp3FromBackend = async (videoUrl) => {
  const downloadUrl = `${FASTAPI_URL}/youtube/download/mp3?url=${encodeURIComponent(videoUrl)}`;
  const { data, headers } = await axios.post(downloadUrl, null, {
    responseType: 'arraybuffer',
  });

  const filenameFromHeader = headers['content-disposition']?.match(/filename="(.+?)"/)?.[1];
  const fileName = filenameFromHeader || `${uuidv4()}.mp3`;

  return { buffer: data, fileName };
};

/**
 * Sends status update to user
 */
const sendStatus = async (client, jid, text, quoted) => {
  await client.sendMessage(jid, { text }, { quoted });
};

/**
 * Main play command handler
 */
export async function play(message, client) {
  const remoteJid = message.key.remoteJid;
  const text = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  ).toLowerCase();

  try {
    // 1. Extract title
    const title = extractQuery(text);
    if (!title) {
      return await sendStatus(client, remoteJid, '❌ Please provide a video title.', message);
    }

    console.log(`🎯 Searching YouTube (API): ${title}`);
    await sendStatus(client, remoteJid, `> _*Searching and processing: ${title}*_`, message);

    // 2. Search YouTube
    const { title: videoTitle, url: videoUrl, thumbnail } = await searchYouTubeVideo(title);
    console.log(`🎯 Found video: ${videoTitle} (${videoUrl})`);

    // 3. Download audio
    const { buffer: audioBuffer, fileName } = await downloadMp3FromBackend(videoUrl);

    // 4. Send thumbnail + info
    await client.sendMessage(remoteJid, {
      image: { url: thumbnail },
      caption: `> 🎵 *${videoTitle}*\n\n> 🔗 ${videoUrl}\n\n> 📥 Downloading audio...\n\n> Powered By ${OWNER_NAME} Tech`,
    }, { quoted: message });

    // 5. Send audio file
    await client.sendMessage(remoteJid, {
      audio: audioBuffer,
      mimetype: 'audio/mp4',
      fileName,
      ptt: false,
    }, { quoted: message });

    console.log(`✅ Audio sent: ${fileName}`);

  } catch (error) {
    console.error('❌ Error in play command:', error);
    const errorMessage = error.response
      ? `Server error: ${error.response.status}`
      : error.message;

    await sendStatus(client, remoteJid, `❌ Failed to play: ${errorMessage}`, message);
  }
}

export default play;