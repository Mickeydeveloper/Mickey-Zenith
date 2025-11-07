import axios from 'axios';
import axiosRetry from 'axios-retry';

export async function tiktok(message, client) {
  const remoteJid = message.key.remoteJid;

  const messageBody = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  );

  try {
    const url = extractTikTokUrl(messageBody);

    if (!url) {
      await client.sendMessage(remoteJid, {
        text: '❌ Please provide a valid TikTok URL.'
      });
      return;
    }

    console.log(`🎯 Fetching TikTok video from: ${url}`);

    await client.sendMessage(remoteJid, {
      text: `> _*Downloading TikTok video...*_`,
      quoted: message
    });

    // Ensure axios has retry configured for transient errors
    try {
      axiosRetry(axios, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        // Retry on network errors, idempotent request errors, and common transient statuses
        retryCondition: (error) =>
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          error.response?.status === 503,
        shouldResetTimeout: true,
      });
    } catch (e) {
      // If axios-retry isn't available or fails to configure, continue without retry
      console.warn('⚠️ axios-retry configuration failed:', e?.message || e);
    }

    // Try multiple API endpoints
    let response;
    try {
        // First attempt with primary API
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        response = await axios.get(apiUrl, { timeout: 15000 });
    } catch (err) {
        // Fallback to secondary API
        const backupApiUrl = `https://api.vreden.my.id/api/v1/download/tiktok?url=${encodeURIComponent(url)}`;
        response = await axios.get(backupApiUrl, { timeout: 15000 });
    }

    if (!response || response.status !== 200) {
      throw new Error(`API request failed with status ${response?.status || 'unknown'}`);
    }

    const data = response.data;

    // Handle different API response structures
    let videoUrl = null;
    let videoDesc = '';

    // First structure (api.vreden.my.id)
    if (data?.result?.download?.video || data?.result?.video) {
        videoUrl = data?.result?.download?.video || data?.result?.video;
        videoDesc = data?.result?.title || data?.result?.description || '';
    }
    // Second structure (different API format)
    else if (data?.data) {
        videoUrl = data?.data?.play || data?.data?.download_url || data?.data?.video_url || null;
        videoDesc = data?.data?.title || '';
    }

    if (!videoUrl && data?.url) {
        videoUrl = data.url; // Some APIs return the URL directly
    }

    if (!videoUrl) {
      // Provide more debugging information when API returns but without expected fields
      const apiMsg = data?.message || data?.error || JSON.stringify(data).slice(0, 200);
      throw new Error(`API returned no downloadable video. ${apiMsg}`);
    }

    // Send the no-watermark video
    await client.sendMessage(remoteJid, {
      video: { url: videoUrl },
      mimetype: 'video/mp4',
      caption: `${videoDesc}\n\n> 🎵 Downloaded by Mickey Zenith:`,
      quoted: message
    });

    console.log('✅ TikTok video sent.');

  } catch (err) {
    console.error('❌ Error in tiktok command:', err?.message || err);
    // Try to send a friendly error message
    const errText = err?.message ? String(err.message) : 'Unknown error while processing TikTok video.';
    await client.sendMessage(remoteJid, {
      text: `❌ Failed to download TikTok video: ${errText}`
    });
  }
}

// Extract the first TikTok URL from a message body (handles full URLs pasted alone or with other text)
function extractTikTokUrl(body) {
  if (!body) return null;
  // Find http(s) links containing tiktok.com
  const urlRegex = /(https?:\/\/(?:www\.)?tiktok\.com\S+)|(https?:\/\/(?:vm|vt)\.tiktok\.com\S+)/i;
  const match = body.match(urlRegex);
  if (match) return match[0];

  // If the entire message is just a URL without protocol, try a looser match
  const looseRegex = /(?:www\.)?tiktok\.com\S+/i;
  const loose = body.match(looseRegex);
  if (loose) {
    let found = loose[0];
    // Prepend protocol if missing
    if (!/^https?:\/\//i.test(found)) found = 'https://' + found;
    return found;
  }

  return null;
}

export default tiktok;
