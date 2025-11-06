import fetch from "node-fetch"
import yts from "yt-search"
import axios from "axios"
import { OWNER_NAME, BOT_NAME } from "../config.js"

const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/

function formatViews(views) {
  if (views === undefined || views === null) return "Not available"
  const n = Number(views)
  if (isNaN(n)) return String(views)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B (${n.toLocaleString()})`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M (${n.toLocaleString()})`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k (${n.toLocaleString()})`
  return n.toString()
}

export async function play(message, client) {
  const remoteJid = message?.key?.remoteJid
  if (!remoteJid) return

  try {
    const rawBody = message.message?.extendedTextMessage?.text || message.message?.conversation || ""
    const parts = rawBody.trim().split(/\s+/)
    const query = parts.slice(1).join(" ").trim()

    if (!query) {
      return await client.sendMessage(remoteJid, { text: "? Please enter the name of the music to download.\nUsage: .play <song name>" }, { quoted: message })
    }

    const videoIdMatch = query.match(youtubeRegexID) || rawBody.match(youtubeRegexID) || null
    let searchTarget = videoIdMatch ? `https://youtu.be/${videoIdMatch[1]}` : query

    const ytRes = await yts(searchTarget)
    let video = null
    if (videoIdMatch) {
      const vid = videoIdMatch[1]
      video = (ytRes.all || []).find(i => i.videoId === vid) || (ytRes.videos || []).find(i => i.videoId === vid)
    }
    video = video || ytRes.all?.[0] || ytRes.videos?.[0] || ytRes

    if (!video) {
      return await client.sendMessage(remoteJid, { text: "? No results found for your search." }, { quoted: message })
    }

    let { title, thumbnail, timestamp, views, ago, url, author } = video
    title = title || "Not found"
    thumbnail = thumbnail || ""
    timestamp = timestamp || "Not found"
    views = views || "Not found"
    ago = ago || "Not found"
    url = url || "Not found"
    author = author || {}

    const formattedViews = formatViews(views)
    const channel = author.name ? author.name : (author || "Unknown")
    const infoMessage = `「✦」Downloading *<${title}>*\n\n> ✧ Channel » *${channel}*\n> ✰ Views » *${formattedViews}*\n> ⴵ Duration » *${timestamp}*\n> ✐ Published » *${ago}*`

    let thumbBuffer = null
    try {
      if (thumbnail) {
        const res = await axios.get(thumbnail, { responseType: "arraybuffer", timeout: 10000 })
        thumbBuffer = Buffer.from(res.data)
      }
    } catch (e) {
      thumbBuffer = null
    }

    const contextInfo = thumbBuffer ? { contextInfo: { externalAdReply: { title: BOT_NAME, body: OWNER_NAME, mediaType: 1, previewType: 0, mediaUrl: url, sourceUrl: url, thumbnail: thumbBuffer, renderLargerThumbnail: true } } } : {}

    await client.sendMessage(remoteJid, { text: infoMessage, ...contextInfo }, { quoted: message })

    try {
      // Download audio
      const api = await (await fetch(`https://api.vreden.my.id/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=128`)).json()
      const result = api?.result?.download?.url || api?.result?.url || api?.data?.url || api?.url
      const fileTitle = api?.result?.title || title
      if (!result) throw new Error("? The audio link was not generated properly.")

      // Get high quality thumbnail
      let thumbnailBuffer = null
      try {
        const highQualityThumbnail = `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`
        const thumbResponse = await axios.get(highQualityThumbnail, { responseType: 'arraybuffer', timeout: 10000 })
        thumbnailBuffer = Buffer.from(thumbResponse.data)
      } catch {
        try {
          // Fallback to medium quality thumbnail
          const mediumThumbnail = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
          const thumbResponse = await axios.get(mediumThumbnail, { responseType: 'arraybuffer', timeout: 10000 })
          thumbnailBuffer = Buffer.from(thumbResponse.data)
        } catch (e) {
          thumbnailBuffer = thumbBuffer // Use the original thumbnail as last resort
        }
      }

      
      await client.sendMessage(remoteJid, audioMessage, { quoted: message })
    } catch (e) {
      return await client.sendMessage(remoteJid, { text: "?? Could not send the audio. The file might be too large or the URL generation failed. Please try again later." }, { quoted: message })
    }

  } catch (error) {
    console.error("Play handler error:", error)
    return await client.sendMessage(message.key.remoteJid, { text: `?? An error occurred: ${error.message || error}` }, { quoted: message })
  }
}

export default play
