
import acrcloud from "acrcloud";
// note: franceking export was removed — this command doesn't require it
import fs from "fs";
import path from "path";

const TEMP_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

async function identifySong(buffer) {
  const acr = new acrcloud({
    host: 'identify-us-west-2.acrcloud.com',
    access_key: '4ee38e62e85515aeb3d26fb741',
    access_secret: 'KZd3cUQoOYSmZQn1n5ACW5XSbqGlKLhg6G8S8EvJ',
    data_type: 'audio',
    audio_format: 'raw',
    sample_rate: 44100,
    audio_channels: 2
  });

  // Try recognition up to 2 times
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(`[ACR] Attempting song recognition (attempt ${attempt + 1}/2)`);
      const result = await acr.identify(buffer);
      
      if (result.status.code === 0 && result.metadata?.music?.length > 0) {
        console.log('[ACR] Song successfully identified');
        return result.metadata.music[0];
      } else if (result.status.code === 1001) {
        console.log('[ACR] No music found in the audio');
      } else if (result.status.code === 3003) {
        console.log('[ACR] Timeout while identifying');
      } else {
        console.log(`[ACR] Recognition failed with code ${result.status.code}: ${result.status.msg}`);
      }
      
      // Wait 1 second before retry
      if (attempt < 1) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('[ACR] Error during recognition:', err);
    }
  }
  
  return null;
}

export async function shazam(message, client) {
  const fromJid = message.key.remoteJid;
  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) {
    await client.sendMessage(fromJid, {
      text: '🎵 *Reply to a short audio or video message (10–20 seconds) to identify the song.*'
    }, { quoted: message });
    return;
  }

  const filePath = path.join(TEMP_DIR, `media-${Date.now()}.dat`);

  try {
    // Dynamically import bailey and yt-search so missing modules produce a friendly message
    let downloadMediaMessage;
    try {
      const baileysMod = await import('bailey');
      downloadMediaMessage = baileysMod.downloadMediaMessage || baileysMod.default?.downloadMediaMessage;
      if (!downloadMediaMessage) throw new Error('downloadMediaMessage not found in bailey');
    } catch (e) {
      console.error('Missing or invalid bailey:', e.message || e);
      await client.sendMessage(fromJid, { text: '⚠️ Required package "bailey" is not installed or incompatible. Please check your project setup.' }, { quoted: message });
      return;
    }

    const stream = await downloadMediaMessage(
      { message: quoted },
      'stream',
      {},
      { logger: console }
    );

    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    await new Promise(resolve => writeStream.on('finish', resolve));

    // Read the audio buffer
    let buffer = fs.readFileSync(filePath);
    
    // Take a sample from the middle of the audio (usually contains the main part of the song)
    const MAX_SIZE = 10 * 1024 * 1024; // Increased to 10MB for better recognition
    if (buffer.length > MAX_SIZE) {
      const startPos = Math.floor((buffer.length - MAX_SIZE) / 2);
      buffer = buffer.slice(startPos, startPos + MAX_SIZE);
    }

    // First try to identify
    let matchedSong = await identifySong(buffer);
    
    // If first attempt fails, try with a different section of the audio
    if (!matchedSong && buffer.length > MAX_SIZE) {
      console.log('[SHZ] First attempt failed, trying with different audio section...');
      buffer = buffer.slice(0, MAX_SIZE); // Try start of the file instead
      matchedSong = await identifySong(buffer);
    }    if (!matchedSong) {
      await client.sendMessage(fromJid, {
        text: '❌ *Song could not be recognized.*\n\n' +
             'Tips for better recognition:\n' +
             '• Send a 10-20 second clip\n' +
             '• Include the chorus or most recognizable part\n' +
             '• Avoid clips with too much talking/noise\n' +
             '• Make sure the audio is clear and not distorted'
      }, { quoted: message });
      return;
    }

    const { title, artists, album, genres, release_date } = matchedSong;
    const ytQuery = `${title} ${artists?.[0]?.name || ''}`;
    // Dynamically import yt-search to avoid startup module-not-found errors
    let ytSearchModule;
    try {
      const mod = await import('yt-search');
      ytSearchModule = mod.default || mod;
    } catch (e) {
      console.error('Missing yt-search:', e.message || e);
      // proceed without YouTube link but inform user
      ytSearchModule = null;
    }
    const ytSearch = ytSearchModule ? await ytSearchModule(ytQuery) : null;

    let response = `🎶 *Song Identified!*\n\n`;
    response += `🎧 *Title:* ${title || 'Unknown'}\n`;
    if (artists) response += `👤 *Artist(s):* ${artists.map(a => a.name).join(', ')}\n`;
    if (album?.name) response += `💿 *Album:* ${album.name}\n`;
    if (genres?.length) response += `🎼 *Genre:* ${genres.map(g => g.name).join(', ')}\n`;
    if (release_date) {
      const [year, month, day] = release_date.split('-');
      response += `📅 *Released:* ${day}/${month}/${year}\n`;
    }
    if (ytSearch?.videos?.[0]?.url) response += `🔗 *YouTube:* ${ytSearch.videos[0].url}\n`;
    response += `\n*POWERED BY FLASH-MD V2*`;

    await client.sendMessage(fromJid, {
      text: response.trim(),
      contextInfo: {
        forwardingScore: 777,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363238139244263@newsletter',
          newsletterName: 'FLASH-MD',
          serverMessageId: -1
        }
      }
    }, { quoted: message });

  } catch (err) {
    console.error('[SHZ ERROR]', err);
    await client.sendMessage(fromJid, {
      text: '⚠️ *Error:* Unable to recognize the song. Please try again with a clear, short clip (10–20s).'
    }, { quoted: message });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export default shazam;
