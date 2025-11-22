import axios from 'axios';
import axiosRetry from 'axios-retry';
import configManager from '../utils/manageConfigs.js';
import fs from 'fs';
import path from 'path';

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

    // Try built-in API endpoints first (defined here so no config change is required).
    // Replace these templates with working Facebook download APIs. Use '{url}' as placeholder.
    const DEFAULT_FACEBOOK_APIS = [
      // Example placeholder - replace with a real working API endpoint
      'https://api.vreden.my.id/api/v1/download/facebook?url={url}',
      // Add more endpoints if you have them
    ];
    // Use the in-file defaults; do not rely on config.json for API endpoints.
    const apis = DEFAULT_FACEBOOK_APIS;
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
      // Follow redirects and get final HTML
      const page = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 5 });
      let html = String(page.data || '');

      // Helper: attempt to extract first URL after a key
      const extractUrlAfterKey = (key, ctxLen = 1200) => {
        const idx = html.indexOf(key);
        if (idx === -1) return null;
        const snippet = html.slice(idx, idx + ctxLen);
        const m = snippet.match(/https?:\/\/[^\"'\s<>]+/i);
        if (!m) return null;
        return m[0].replace(/\\u0025/g, '%').replace(/\\\//g, '/');
      };

      // 1) Try og:video meta tag
      const og = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
      if (og && og[1]) videoUrl = og[1];

      // 2) Try multiple known JSON keys used by Facebook pages
      const keysToTry = ['playable_url', 'playable_url_quality_hd', 'playable_url_quality_sd', 'hd_src_no_ratelimit', 'hd_src', 'sd_src_no_ratelimit', 'sd_src', 'playable_url_with_sound', 'video_url'];
      for (const k of keysToTry) {
        if (videoUrl) break;
        const found = extractUrlAfterKey(k);
        if (found) videoUrl = found;
      }

      // 3) Some pages include JSON blobs with escaped slashes; attempt unescaping and search
      if (!videoUrl) {
        const unescaped = html.replace(/\\\\/g, '\\').replace(/\\u0025/g, '%').replace(/\\\//g, '/');
        for (const k of keysToTry) {
          if (videoUrl) break;
          const idx2 = unescaped.indexOf(k);
          if (idx2 === -1) continue;
          const snippet = unescaped.slice(idx2, idx2 + 1200);
          const m2 = snippet.match(/https?:\/\/[^\"'\s<>]+/i);
          if (m2) videoUrl = m2[0];
        }
      }

      // 4) As last resort, search for any mp4 urls in the HTML
      if (!videoUrl) {
        const any = html.match(/https?:\/\/[^\"'\s<>]+\.mp4(?:\?[^\"'\s<>]*)?/i);
        if (any) videoUrl = any[0].replace(/\\\//g, '/');
      }
    }

    // If extraction failed, try the mbasic.facebook.com variant which often exposes direct links
    if (!videoUrl) {
      try {
        let mbasicUrl = url.replace(/https?:\/\/www\./i, 'https://mbasic.');
        // also handle m.facebook.com -> mbasic.facebook.com
        mbasicUrl = mbasicUrl.replace(/https?:\/\/m\./i, 'https://mbasic.');
        const mbPage = await axios.get(mbasicUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 5 });
        const mbHtml = String(mbPage.data || '');
        // search for /video_redirect/ or direct mp4 links
        const redirectMatch = mbHtml.match(/href="([^"]*video_redirect[^"]*)"/i) || mbHtml.match(/href='([^']*video_redirect[^']*)'/i);
        if (redirectMatch && redirectMatch[1]) {
          let link = redirectMatch[1];
          // Unescape if needed
          link = link.replace(/&amp;/g, '&');
          if (!/^https?:\/\//i.test(link)) {
            // relative link: prefix with mbasic host
            const base = new URL(mbasicUrl).origin;
            link = base + link;
          }
          // follow redirect to get actual video URL
          try {
            const final = await axios.get(link, { timeout: 20000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
            // if final response is a redirect, axios follows it; otherwise try to extract any mp4
            const finalHtml = String(final.data || '');
            const mp4 = finalHtml.match(/https?:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?/i);
            if (mp4) videoUrl = mp4[0];
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore mbasic attempt errors
      }
    }

    if (!videoUrl) {
      // Save debug HTML for inspection
      try {
        const debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
        const debugFile = path.join(debugDir, `facebook_debug_${Date.now()}.html`);
        // Prefer the last fetched html (page or mbasic), but fallback to empty string
        const lastHtml = (typeof html !== 'undefined') ? html : '';
        fs.writeFileSync(debugFile, lastHtml, 'utf8');
        throw new Error(`Could not extract Facebook video URL. Saved debug HTML to ${debugFile} — please paste its contents or a sample public video URL so I can improve extraction.`);
      } catch (writeErr) {
        throw new Error('Could not extract Facebook video URL and failed to write debug HTML: ' + (writeErr.message || writeErr));
      }
    }

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
