import axios from 'axios';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import path from 'path';

// === Facebook video downloader (tiktok.js style) ===
export async function facebook(message, client) {
  const remoteJid = message?.key?.remoteJid;
  const body = (
    message.message?.extendedTextMessage?.text ||
    message.message?.conversation ||
    ''
  ).toString();

  if (!remoteJid) return;

  const url = extractFacebookUrl(body);
  if (!url) {
    await client.sendMessage(remoteJid, { text: '❌ Please provide a valid Facebook URL.' });
    return;
  }

  try {
    console.log(`🎯 Fetching Facebook video from: ${url}`);
    await client.sendMessage(remoteJid, { text: `> _*Downloading Facebook video...*_`, quoted: message });

    // configure axios retry
    try {
      axiosRetry(axios, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) =>
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          error.response?.status === 503,
        shouldResetTimeout: true,
      });
    } catch (e) {
      console.warn('⚠️ axios-retry configuration failed:', e?.message || e);
    }

    // Built-in API templates to try (replace or extend with working endpoints)
    const API_TEMPLATES = [
      'https://api.vreden.my.id/api/v1/download/facebook?url={url}',
      // Add more templates if you have them: 'https://example.com/fb?url={url}'
    ];

    let apiResponse = null;
    for (const tpl of API_TEMPLATES) {
      try {
        const apiUrl = tpl.replace('{url}', encodeURIComponent(url));
        const res = await axios.get(apiUrl, { timeout: 15000 });
        if (res && res.status === 200) {
          apiResponse = res.data;
          break;
        }
      } catch (e) {
        console.warn('API template failed:', tpl, e?.message || e);
      }
    }

    // Try to parse API response if present
    let videoUrl = null;
    let videoDesc = '';

    if (apiResponse) {
      const d = apiResponse;
      if (d?.result?.download?.video || d?.result?.video) {
        videoUrl = d.result?.download?.video || d.result?.video;
        videoDesc = d.result?.title || d.result?.description || '';
      } else if (d?.data) {
        videoUrl = d.data?.play || d.data?.download_url || d.data?.video || d.data?.video_url || null;
        videoDesc = d.data?.title || '';
      } else if (d?.url) {
        videoUrl = d.url;
      }
    }

    // If no API result, fallback to scraping
    let pageHtml = '';
    if (!videoUrl) {
      try {
        const page = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 5 });
        pageHtml = String(page.data || '');
      } catch (e) {
        console.warn('Failed to fetch page HTML:', e?.message || e);
      }

      // 1) og:video
      try {
        const og = pageHtml.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
        if (og && og[1]) videoUrl = og[1];
      } catch (e) {}

      // 2) common keys
      const keys = ['playable_url', 'playable_url_quality_hd', 'playable_url_quality_sd', 'hd_src', 'sd_src', 'video_url'];
      for (const k of keys) {
        if (videoUrl) break;
        const idx = pageHtml.indexOf(k);
        if (idx !== -1) {
          const snippet = pageHtml.slice(idx, idx + 1200);
          const m = snippet.match(/https?:\/\/[^\s\"'<>]+/i);
          if (m) videoUrl = m[0].replace(/\\/g, '/');
        }
      }

      // 3) try mbasic.facebook.com fallback
      if (!videoUrl) {
        try {
          let mbasic = url.replace(/https?:\/\/www\./i, 'https://mbasic.');
          mbasic = mbasic.replace(/https?:\/\/m\./i, 'https://mbasic.');
          const mb = await axios.get(mbasic, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 5 });
          const mbHtml = String(mb.data || '');
          const redirectMatch = mbHtml.match(/href=\"([^\"]*video_redirect[^\"]*)\"/i) || mbHtml.match(/href='([^']*video_redirect[^']*)'/i);
          if (redirectMatch && redirectMatch[1]) {
            let link = redirectMatch[1].replace(/&amp;/g, '&');
            if (!/^https?:\/\//i.test(link)) link = new URL(mbasic).origin + link;
            try {
              const final = await axios.get(link, { timeout: 20000, maxRedirects: 5, headers: { 'User-Agent': 'Mozilla/5.0' } });
              const finalHtml = String(final.data || '');
              const mp4 = finalHtml.match(/https?:\/\/[^\s\"'<>]+\.mp4(?:\?[^\s\"'<>]*)?/i);
              if (mp4) videoUrl = mp4[0];
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 4) last resort: any mp4 in pageHtml
      if (!videoUrl) {
        const any = pageHtml.match(/https?:\/\/[^\s\"'<>]+\.mp4(?:\?[^\s\"'<>]*)?/i);
        if (any) videoUrl = any[0];
      }
    }

    if (!videoUrl) {
      // save debug HTML to file for inspection
      try {
        const debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
        const debugFile = path.join(debugDir, `facebook_debug_${Date.now()}.html`);
        fs.writeFileSync(debugFile, pageHtml || '', 'utf8');
        throw new Error(`Could not extract Facebook video URL. Saved debug HTML to ${debugFile}`);
      } catch (e) {
        throw new Error('Could not extract Facebook video URL and failed to write debug HTML: ' + (e.message || e));
      }
    }

    // Send the video by URL
    await client.sendMessage(remoteJid, {
      video: { url: videoUrl },
      mimetype: 'video/mp4',
      caption: `${videoDesc || ''}\n\n> 🎬 Downloaded by Mickey Zenith:`,
      quoted: message
    });

    console.log('✅ Facebook video sent.');
  } catch (err) {
    console.error('❌ Error in facebook command:', err?.message || err);
    const errText = err?.message ? String(err.message) : 'Unknown error while processing Facebook video.';
    await client.sendMessage(remoteJid, { text: `❌ Failed to download Facebook video: ${errText}` });
  }
}

// Extract common Facebook video URLs
function extractFacebookUrl(body) {
  if (!body) return null;
  const urlMatch = body.match(/https?:\/\/[^\s]+facebook\.com[^\s]*/i) || body.match(/https?:\/\/fb\.watch\/[A-Za-z0-9_-]+/i);
  if (urlMatch) return urlMatch[0];
  const loose = body.match(/(?:www\.)?facebook\.com\S+/i);
  if (loose) {
    let found = loose[0];
    if (!/^https?:\/\//i.test(found)) found = 'https://' + found;
    return found;
  }
  return null;
}

export default facebook;