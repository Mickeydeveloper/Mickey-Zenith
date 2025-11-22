import axios from 'axios';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import path from 'path';

// Configure axios retry globally once
axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s...
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    [429, 500, 502, 503, 504].includes(error.response?.status),
});

const WORKING_APIS = [
 
  'https://www.tikwm.com/api/?url=', 
  'https://api.vreden.my.id/api/v1/download/facebook?url=',
];

export async function facebook(message, client) {
  const remoteJid = message?.key?.remoteJid;
  const text = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  ).trim();

  if (!remoteJid) return;

  const url = extractFacebookUrl(text);
  if (!url) {
    return client.sendMessage(remoteJid, { text: '❌ Please send a valid Facebook video link.' });
  }

  try {
    await client.sendMessage(remoteJid, { text: '⏳ Fetching your Facebook video...' });

    let videoUrl = null;
    let caption = '🎥 Facebook Video';

    // Step 1: Try multiple working APIs
    for (const api of WORKING_APIS) {
      try {
        const apiUrl = api.includes('{url}') ? api.replace('{url}', encodeURIComponent(url)) : api;
        const payload = apiUrl.includes('fdownloader.net') || apiUrl.includes('savefromfb') 
          ? { url } 
          : {}; // Some need POST body

        const res = await axios({
          method: apiUrl.includes('fdownloader.net') || apiUrl.includes('savefromfb') ? 'POST' : 'GET',
          url: apiUrl,
          data: payload,
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json',
            'Origin': 'https://fbdown.net',
            'Referer': 'https://fbdown.net/',
          },
        });

        const data = res.data;

        // Extract HD or SD link from various API responses
        if (data?.hd || data?.sd || data?.url || data?.video || data?.download) {
          videoUrl = data.hd || data.sd || data.url || data.video || data.download;
          caption = data.title || data.desc || caption;
          console.log(`✅ Video found via API: ${apiUrl.split('/').slice(0, 3).join('/')}`);
          break;
        }

        // Special handling for fdownloader.net
        if (data?.result?.hd) {
          videoUrl = data.result.hd;
          caption = data.result.title || caption;
          break;
        }

      } catch (err) {
        console.warn(`API failed: ${api.split('/').slice(0, 3).join('/')}`, err.message);
        continue;
      }
    }

    // Step 2: If all APIs fail → Smart scraping fallback (still works in 2025)
    if (!videoUrl) {
      console.log('Falling back to direct scraping...');
      const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'navigate',
      };

      try {
        const { data: html } = await axios.get(url, { headers, timeout: 20000, maxRedirects: 10 });

        // Method 1: Look for HD/SD URLs in JSON blobs
        const jsonMatch = html.match(/"playable_url_quality_hd":"([^"]+)"/) || 
                         html.match(/"playable_url":"([^"]+)"/) ||
                         html.match(/"hd_src":"([^"]+)"/) ||
                         html.match(/"sd_src":"([^"]+)"/);

        if (jsonMatch) {
          videoUrl = jsonMatch[1].replace(/\\/g, '');
        }

        // Method 2: mbasic.facebook.com redirect trick (works on private videos too!)
        if (!videoUrl) {
          const mbasicUrl = url.replace(/^https?:\/\/(www\.)?facebook\.com/, 'https://mbasic.facebook.com');
          const { data: mbHtml } = await axios.get(mbasicUrl, { headers, timeout: 15000 });

          const redirectLink = mbHtml.match(/href="([^"]*video_redirect[^"]*)"/);
          if (redirectLink) {
            let redirect = redirectLink[1].replace(/&amp;/g, '&');
            if (!redirect.startsWith('http')) redirect = 'https://mbasic.facebook.com' + redirect;
            const final = await axios.get(redirect, { headers, maxRedirects: 0, validateStatus: null });
            if (final.headers.location) {
              videoUrl = final.headers.location;
            }
          }
        }

        // Method 3: Direct .mp4 in page
        if (!videoUrl) {
          const mp4 = html.match(/https?:\/\/[^"\s]+\.mp4[^"\s]*/g);
          if (mp4 && mp4.length > 0) {
            videoUrl = mp4.find(u => u.includes('videocdn') || u.includes('fbcdn')) || mp4[0];
          }
        }
      } catch (e) {
        console.warn('Scraping failed:', e.message);
      }
    }

    // Final check
    if (!videoUrl || !videoUrl.includes('http')) {
      return client.sendMessage(remoteJid, { 
        text: '❌ Sorry, this video is private, deleted, or region-restricted.\n\nTry another public video!' 
      });
    }

    // Stream & send video safely (handles 1GB+ videos without crashing)
    await client.sendMessage(remoteJid, {
      video: { url: videoUrl, stream: true },
      caption: `${caption.trim()}\n\nDownloaded by *Mickey Zenith* ✨`,
      mimetype: 'video/mp4',
    }, { quoted: message });

    console.log('✅ Facebook video sent successfully!');
    
  } catch (err) {
    console.error('Fatal error:', err);
    await client.sendMessage(remoteJid, { 
      text: `❌ Download failed: ${err.message || 'Unknown error'}\nTry again later.` 
    });
  }
}

// Extract Facebook URL (supports fb.watch, shortened links, etc.)
function extractFacebookUrl(text) {
  const patterns = [
    /https?:\/\/(www\.)?facebook\.com\/\S*/i,
    /https?:\/\/fb\.watch\/[A-Za-z0-9_-]+/i,
    /https?:\/\/(www\.)?fb\.com\/\S*/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].split('?')[0].split('&')[0]; // Clean params
  }
  return null;
}

export default facebook;