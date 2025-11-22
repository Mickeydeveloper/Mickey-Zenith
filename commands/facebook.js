import axios from 'axios';
import axiosRetry from 'axios-retry';
import configManager from '../utils/manageConfigs.js';

export async function facebook(message, client) {
  const remoteJid = message?.key?.remoteJid;
  const messageBody = (message.message?.extendedTextMessage?.text || message.message?.conversation || '').trim();

  if (!remoteJid) return;

  const url = extractFacebookUrl(messageBody);
  if (!url) {
    await client.sendMessage(remoteJid, { text: '❌ Please provide a valid Facebook URL.' });
    return;
  }

  try {
    console.log('🎯 Fetching Facebook video from:', url);
    await client.sendMessage(remoteJid, { text: '> _*Downloading Facebook video...*_', quoted: message });

    // configure axios-retry but ignore failures configuring it
    try { axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay }); } catch (e) {}

    // Try configured APIs first
    const apis = Array.isArray(configManager.config?.facebookApis) ? configManager.config.facebookApis : [];
    let videoUrl = null;
    let videoDesc = '';

    for (const tpl of apis) {
      if (!tpl || typeof tpl !== 'string') continue;
      try {
        const apiUrl = tpl.replace('{url}', encodeURIComponent(url));
        const r = await axios.get(apiUrl, { timeout: 15000 });
        const d = r.data;
        if (!d) continue;
        if (d.result?.video) { videoUrl = d.result.video; videoDesc = d.result.title || '';} 
        else if (d.result?.download?.video) { videoUrl = d.result.download.video; videoDesc = d.result.title || ''; }
        else if (d.url) { videoUrl = d.url; }
        else if (d.data?.video) { videoUrl = d.data.video; }
        if (videoUrl) break;
      } catch (e) {
        console.warn('facebook api template failed:', tpl, e?.message || e);
      }
    }

    // Fallback: fetch the page HTML and try to extract known fields
    if (!videoUrl) {
      const page = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = String(page.data || '');

      // og:video
      const og = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
      if (og && og[1]) videoUrl = og[1];

      // playable_url (loose substring + url match)
      if (!videoUrl) {
        const idx = html.indexOf('playable_url');
        if (idx !== -1) {
          const snippet = html.slice(idx, idx + 1000);
          const m = snippet.match(/https?:\/\/[^"'\s<>]+/i);
          if (m) videoUrl = m[0].replace(/\\u0025/g, '%').replace(/\\\//g, '/');
        }
      }

      // hd_src or sd_src (loose search then url match)
      if (!videoUrl) {
        const hdIdx = html.indexOf('hd_src');
        if (hdIdx !== -1) {
          const snippet = html.slice(hdIdx, hdIdx + 600);
          const m = snippet.match(/https?:\/\/[^"'\s<>]+/i);
          if (m) videoUrl = m[0].replace(/\\\//g, '/');
        }
      }

      if (!videoUrl) {
        const sdIdx = html.indexOf('sd_src');
        if (sdIdx !== -1) {
          const snippet = html.slice(sdIdx, sdIdx + 600);
          const m = snippet.match(/https?:\/\/[^"'\s<>]+/i);
          if (m) videoUrl = m[0].replace(/\\\//g, '/');
        }
      }
    }

    if (!videoUrl) throw new Error('Could not extract Facebook video URL. Add a working API to config.json under "facebookApis" or provide a different link.');

    await client.sendMessage(remoteJid, { video: { url: videoUrl }, mimetype: 'video/mp4', caption: `${videoDesc}\n\n> 🎬 Downloaded by Mickey Zenith:`, quoted: message });
    console.log('✅ Facebook video sent.');

  } catch (err) {
    console.error('❌ Error in facebook command:', err?.message || err);
    const text = err?.message ? String(err.message) : 'Unknown error while processing Facebook video.';
    await client.sendMessage(remoteJid, { text: `❌ Failed to download Facebook video: ${text}` });
  }
}

function extractFacebookUrl(body) {
  if (!body) return null;
  const urls = body.match(/https?:\/\/[^\s]+/g) || [];
  for (const u of urls) {
    if (/facebook\.com|fb\.watch|m\.facebook\.com/i.test(u)) return u;
  }
  const loose = body.match(/(?:www\.)?facebook\.com\S+/i);
  if (loose) {
    let found = loose[0]; if (!/^https?:\/\//i.test(found)) found = 'https://' + found; return found;
  }
  return null;
}

export default facebook;
