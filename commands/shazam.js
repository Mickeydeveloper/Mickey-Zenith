
import acrcloud from "acrcloud";
// note: franceking export was removed — this command doesn't require it
import fs from "fs";
import path from "path";

const TEMP_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

async function identifySong(buffer) {
  const acr = new acrcloud({
    host: 'identify-eu-west-1.acrcloud.com',
    access_key: 'c35c497b545b37a902ebc1258ea0f617',
    access_secret: '39Ev6RQyHnRNqJ4RXbgE0u7TVMQ2eFpKsLJ9vf3j',
    data_type: 'audio',
    audio_format: 'wav',  // Changed to wav for better recognition
    sample_rate: 48000,   // Increased sample rate
    audio_channels: 1     // Mono channel for clearer recognition
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

  if (!quoted) {
    await client.sendMessage(fromJid, {
      text: `🎵 *Shazam - Music Recognition*\n\n*How to use:*\n1️⃣ Reply to an audio/video with .shazam\n2️⃣ Wait for analysis\n3️⃣ Get song details!\n\n*Tips:*\n- Use clear audio (10-20 seconds)\n- Include song chorus/vocals\n- Avoid noisy backgrounds`
    }, { quoted: message });
    return;
  }

  // Check media type and extract the correct message
  let mediaMessage = null;
  let mediaType = null;

  if (quoted.audioMessage) {
    mediaMessage = quoted.audioMessage;
    mediaType = "audio";
  } else if (quoted.videoMessage) {
    mediaMessage = quoted.videoMessage;
    mediaType = "video";
  } else {
    await client.sendMessage(fromJid, {
      text: `❌ Please reply to an *audio* or *video* message.\n\n_Example: Reply to a song/video with .shazam_`
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

    await client.sendMessage(fromJid, { 
      text: `🎵 Analyzing ${mediaType}...\n_This may take a few seconds..._` 
    }, { quoted: message });

    const stream = await downloadMediaMessage(
      { message: quoted },
      'buffer',  // Changed to buffer for better handling
      {},
      { logger: console }
    );

    // Write buffer to file
    fs.writeFileSync(filePath, stream);

    // Read the audio buffer
    let buffer = fs.readFileSync(filePath);
    
    // Take multiple samples from the audio for better recognition
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB per sample
    let samples = [];
    
    if (buffer.length > MAX_SIZE) {
      // Take sample from start, middle, and end
      samples.push(buffer.slice(0, MAX_SIZE));
      const midStart = Math.floor((buffer.length - MAX_SIZE) / 2);
      samples.push(buffer.slice(midStart, midStart + MAX_SIZE));
      samples.push(buffer.slice(-MAX_SIZE));
    } else {
      samples.push(buffer);
    }

    // Try to identify using multiple samples
    let matchedSong = null;
    for (const sample of samples) {
      matchedSong = await identifySong(sample);
      if (matchedSong) break;
    }
    
    if (!matchedSong) {
      console.log('[SHZ] All recognition attempts failed');
      buffer = buffer.slice(0, MAX_SIZE); // Try start of the file instead
      matchedSong = await identifySong(buffer);
    }    if (!matchedSong) {
      await client.sendMessage(fromJid, {
        text: `❌ *Could not recognize ${mediaType}*\n\n` +
             '🔍 *Try these tips:*\n' +
             '• Use a 10-20 second clip\n' +
             '• Include song chorus or main part\n' +
             '• Reduce background noise\n' +
             '• Ensure clear audio quality\n\n' +
             '_Reply to another audio/video to try again_'
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
