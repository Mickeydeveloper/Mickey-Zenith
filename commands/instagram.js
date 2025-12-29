const { igdl } = require("ruhend-scraper");
const { getBuffer } = require('../lib/myfunc');
const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

// Helper: transcode arbitrary video buffer/file to mp4 (H.264 + AAC) using ffmpeg
async function transcodeToMp4(inputBuffer, srcExt = '.mp4') {
    const tmpDir = os.tmpdir();
    const inPath = path.join(tmpDir, `insta_in_${Date.now()}_${Math.random().toString(36).slice(2)}${srcExt}`);
    const outPath = path.join(tmpDir, `insta_out_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    try {
        fs.writeFileSync(inPath, inputBuffer);

        // ffmpeg command: re-encode to H.264 + AAC and enable faststart for streaming
        const cmd = `ffmpeg -y -i "${inPath}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outPath}"`;
        await execPromise(cmd, { windowsHide: true });

        const outBuffer = fs.readFileSync(outPath);
        return outBuffer;
    } catch (err) {
        // Transcode failed (ffmpeg missing or error) — return null so caller can fallback
        console.error('transcodeToMp4 error:', err?.message || err);
        return null;
    } finally {
        try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath); } catch (e) {}
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) {}
    }
}

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

// Function to extract unique media URLs with simple deduplication
function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();
    
    for (const media of mediaData) {
        if (!media.url) continue;
        
        // Only check for exact URL duplicates
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    
    return uniqueMedia;
}

// Function to validate media URL
function isValidMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Accept any URL that looks like media
    return url.includes('cdninstagram.com') || 
           url.includes('instagram') || 
           url.includes('http');
}

async function instagramCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide an Instagram link for the video."
            });
        }

        // Check for various Instagram URL formats
        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(text));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid Instagram link. Please provide a valid Instagram post, reel, or video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        const downloadData = await igdl(text);
        
        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No media found at the provided link. The post might be private or the link is invalid."
            });
        }

        const mediaData = downloadData.data;
        
        // Simple deduplication - just remove exact URL duplicates
        const uniqueMedia = extractUniqueMedia(mediaData);
        
        // Limit to maximum 20 unique media items
        const mediaToDownload = uniqueMedia.slice(0, 20);
        
        if (mediaToDownload.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No valid media found to download. This might be a private post or the scraper failed."
            });
        }

        // Send only one item: Prefer the first video found, otherwise the first media.
        try {
            const firstVideo = mediaToDownload.find(m => {
                const url = (m.url || '').toString();
                return /\.(mp4|mov|avi|mkv|webm)$/i.test(url) || m.type === 'video';
            });

            const selected = firstVideo || mediaToDownload[0];
            if (!selected) {
                return await sock.sendMessage(chatId, { text: '❌ No media available to send.' }, { quoted: message });
            }

            const mediaUrl = selected.url;
            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || selected.type === 'video' || text.includes('/reel/') || text.includes('/tv/');

            if (isVideo) {
                try {
                    const buffer = await getBuffer(mediaUrl);
                    const ext = (path.extname(mediaUrl) || '.mp4').split('?')[0].toLowerCase();

                    // If not already MP4, try to transcode to mp4 (H.264 + AAC) for maximum compatibility
                    let finalBuffer = buffer;
                    if (buffer && Buffer.isBuffer(buffer) && ext !== '.mp4') {
                        const transcoded = await transcodeToMp4(buffer, ext);
                        if (transcoded && Buffer.isBuffer(transcoded)) {
                            finalBuffer = transcoded;
                        } else {
                            // If transcode failed, keep original buffer
                            finalBuffer = buffer;
                        }
                    }

                    // If buffer is valid, send it as mp4 buffer
                    if (finalBuffer && Buffer.isBuffer(finalBuffer)) {
                        await sock.sendMessage(chatId, {
                            video: finalBuffer,
                            mimetype: 'video/mp4',
                            fileName: `instagram.mp4`,
                            caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                        }, { quoted: message });
                    } else {
                        // Fallback to URL send
                        await sock.sendMessage(chatId, {
                            video: { url: mediaUrl },
                            mimetype: "video/mp4",
                            caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                        }, { quoted: message });
                    }
                } catch (sendErr) {
                    console.error('Error sending video buffer, fallback to URL:', sendErr);
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: "video/mp4",
                        caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                    }, { quoted: message });
                }
            } else {
                await sock.sendMessage(chatId, {
                    image: { url: mediaUrl },
                    caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                }, { quoted: message });
            }

        } catch (singleErr) {
            console.error('Error sending selected media:', singleErr);
            await sock.sendMessage(chatId, { text: '❌ Failed to send media.' }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in Instagram command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An error occurred while processing the Instagram request. Please try again."
        });
    }
}

module.exports = instagramCommand;
