import fetch from "node-fetch";
import yts from "yt-search";
import axios from "axios";
import { OWNER_NAME, BOT_NAME } from "../config.js";
import ytdl from 'ytdl-core';

const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/;

function formatViews(views) {
  if (!views) return "Unknown";
  const n = Number(views);
  if (isNaN(n)) return views;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export async function play(message, client) {
  const remoteJid = message?.key?.remoteJid;
  if (!remoteJid) return;

  try {
    // Extract command query text
    const rawBody =
      message.message?.extendedTextMessage?.text ||
      message.message?.conversation ||
      "";
    const parts = rawBody.trim().split(/\s+/);
    const query = parts.slice(1).join(" ").trim(); // ✅ Use search name

    if (!query) {
      return client.sendMessage(
        remoteJid,
        { text: "❓ Enter video name.\nUsage: *.play <video name>*" },
        { quoted: message }
      );
    }

    // Try to detect YouTube link, else search by name
    const videoIdMatch = query.match(youtubeRegexID);
    const searchTarget = videoIdMatch ? `https://youtu.be/${videoIdMatch[1]}` : query;
    const ytRes = await yts(searchTarget);
    const video = videoIdMatch
      ? ytRes.videos.find((v) => v.videoId === videoIdMatch[1])
      : ytRes.videos?.[0];

    if (!video) {
      return client.sendMessage(
        remoteJid,
        { text: "❌ No video results found." },
        { quoted: message }
      );
    }

    const { title, thumbnail, timestamp, views, ago, author } = video;

    // Download and attach thumbnail preview
    let thumbBuffer = null;
    try {
      const thumbRes = await axios.get(thumbnail, { responseType: "arraybuffer" });
      thumbBuffer = Buffer.from(thumbRes.data);
    } catch {}

    await client.sendMessage(
      remoteJid,
      {
        text: `🎬 *Downloading Video...*\n\n📌 *${title}*\n👤 Channel: *${author?.name}*\n👁️ Views: *${formatViews(
          views
        )}*\n⏱️ Duration: *${timestamp}*\n📆 Uploaded: *${ago}*`,
        ...(thumbBuffer && {
          contextInfo: {
            externalAdReply: {
              title: BOT_NAME,
              body: OWNER_NAME,
              mediaType: 1,
              previewType: 0,
              sourceUrl: searchTarget,
              thumbnail: thumbBuffer,
              renderLargerThumbnail: true,
            },
          },
        }),
      },
      { quoted: message }
    );

    //
    // ✅ API CALL (Fixed Unexpected token '<' Error)
    //
    const fetchApi = await fetch(
      `https://api.vreden.my.id/api/v1/download/play/video?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
      }
    );

    const rawResponse = await fetchApi.text();

    let api;
    try {
      api = JSON.parse(rawResponse);
    } catch (e) {
      console.log("🔴 API returned HTML (not JSON):\n", rawResponse); // debug log
      // API failed — attempt fallback using ytdl-core for YouTube sources
      try {
        const ytUrl = videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : (video.url || searchTarget);
        if (ytUrl && ytdl && ytdl.getInfo) {
          const info = await ytdl.getInfo(ytUrl).catch(() => null);
          if (info && info.formats && info.formats.length) {
            // Prefer mp4 formats with both audio+video
            const candidates = info.formats.filter(f => (f.container === 'mp4' || /mp4/i.test(f.mimeType || '')) && f.hasVideo && f.hasAudio && f.url);
            // Sort by bitrate (approx) or quality
            candidates.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const chosen = candidates.find(f => f.contentLength && Number(f.contentLength) < 50_000_000) || candidates[0];
            if (chosen && chosen.url) {
              console.log('✅ Using ytdl fallback format url');
              api = { result: { download: { url: chosen.url } } };
            }
          }
        }
      } catch (err) {
        console.debug('ytdl fallback failed:', err?.message || err);
      }

      if (!api) throw new Error("API returned HTML / Server is blocking request.");
    }

    //
    // ✅ Extract download URL safely
    //
    const resultUrl =
      api?.result?.download?.url ||
      api?.result?.video?.url ||
      api?.result?.url ||
      api?.data?.url ||
      api?.url ||
      null;

    if (!resultUrl) {
      console.log("🚫 VIDEO API RAW JSON:", api);
      throw new Error("API did not return a valid video URL.");
    }

    //
    // ✅ SEND VIDEO TO USER
    //
    await client.sendMessage(
      remoteJid,
      {
        video: { url: resultUrl },
        caption: `✅ *${title}*\n\nPowered by: ${BOT_NAME}`,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("❌ Play video error:", error);
    return client.sendMessage(
      remoteJid,
      { text: `❌ Error: ${error.message}` },
      { quoted: message }
    );
  }
}

export default play;