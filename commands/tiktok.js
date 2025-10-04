import axios from 'axios';

// List of APIs to try (in order)
const API_TEMPLATES = [
  (url) => `https://api.princetechn.com/api/download/tiktok?apikey=prince&url=${encodeURIComponent(url)}`,
  (url) => `https://api.princetechn.com/api/download/tiktokdlv2?apikey=prince&url=${encodeURIComponent(url)}`,
  (url) => `https://api.princetechn.com/api/download/tiktokdlv3?apikey=prince&url=${encodeURIComponent(url)}`,
  (url) => `https://api.princetechn.com/api/download/tiktokdlv4?apikey=prince&url=${encodeURIComponent(url)}`,
  (url) => `https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(url)}`
];

export async function tiktok(message, client) {
  const remoteJid = message.key.remoteJid;

  const messageBody = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  );

  try {
    const url = getArg(messageBody);

    if (!url || !url.includes('tiktok.com')) {
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

    let lastError = null;
    let finalVideoUrl = null;
    let finalThumb = null;

    for (const tpl of API_TEMPLATES) {
      const apiUrl = tpl(url);
      console.log(`➡ Trying API: ${apiUrl}`);
      try {
        const res = await axios.get(apiUrl, { timeout: 15000 });
        const data = res.data;

        // If API returned a plain string (direct link), use it
        if (typeof data === 'string' && data.startsWith('http')) {
          finalVideoUrl = data;
        }

        // If API returned an object, try to find a video URL in common fields
        if (!finalVideoUrl && typeof data === 'object') {
          // Some APIs respond with { success: true, results: { no_watermark: '...' } }
          finalVideoUrl = data?.results?.no_watermark || data?.no_watermark || data?.video || data?.video_url || data?.videoUrl || data?.download || data?.download_url || data?.data?.video || data?.result?.video || data?.data?.play || null;

          // dreaded.site returns { video: { url: '...' }, ... }
          if (!finalVideoUrl && data?.video?.url) finalVideoUrl = data.video.url;

          // thumbnail
          finalThumb = data?.results?.thumbnail || data?.thumbnail || data?.thumb || data?.data?.thumbnail || data?.result?.thumbnail || null;
        }

        if (finalVideoUrl) {
          console.log('✅ Got video URL from API');
          break;
        }

      } catch (err) {
        console.warn(`⚠ API failed: ${apiUrl} -> ${err.message}`);
        lastError = err;
        continue; // try next API
      }
    }

    if (!finalVideoUrl) {
      throw new Error(lastError ? lastError.message : 'No API returned a video URL.');
    }

    // Send thumbnail + caption if available
    const caption = `> 🎵 TikTok Video — Hope You Enjoy\n\n> 🔗 ${url}\n\n> Powered by Senku Tech`;
    if (finalThumb) {
      await client.sendMessage(remoteJid, {
        image: { url: finalThumb },
        caption,
        quoted: message
      });
    } else {
      await client.sendMessage(remoteJid, { text: caption, quoted: message });
    }

    // Send the video by URL (WhatsApp client will fetch it)
    await client.sendMessage(remoteJid, {
      video: { url: finalVideoUrl },
      mimetype: 'video/mp4',
      caption: `> 🎵 TikTok Video Hope You Enjoy\n\n> Powered by Senku Tech`,
      quoted: message
    });

    console.log('✅ TikTok video sent.');

  } catch (err) {
    console.error('❌ Error in tiktok command:', err);
    await client.sendMessage(remoteJid, {
      text: `❌ Failed to download TikTok video: ${err.message}`
    });
  }
}

// Extract TikTok URL from user message
function getArg(body) {
  const parts = body.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

export default tiktok;
