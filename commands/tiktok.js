const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
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
                text: "Please provide a TikTok link for the video."
            });
        }

        // Extract URL from command
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        // Check for various TikTok URL formats
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        try {
            // Use only Siputzx API
            const apiUrl = `https://api.vreden.my.id/api/v1/download/tiktok?url=${encodeURIComponent(url)}`;



            let videoUrl = null;
            let audioUrl = null;
            let title = null;

            // Call Siputzx API
            try {
                const response = await axios.get(apiUrl, { 
                    timeout: 15000,
                    headers: {
                        'accept': '*/*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && response.data.status) {
                    // Check if the API returned video data
                    if (response.data.data) {
                        // Check for urls array first (this is the main response format)
                        if (response.data.data.urls && Array.isArray(response.data.data.urls) && response.data.data.urls.length > 0) {
                            // Use the first URL from the urls array (usually HD quality)
                            videoUrl = response.data.data.urls[0];
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else if (response.data.data.video_url) {
                            videoUrl = response.data.data.video_url;
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else if (response.data.data.url) {
                            videoUrl = response.data.data.url;
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else if (response.data.data.download_url) {
                            videoUrl = response.data.data.download_url;
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else {
                            throw new Error("No video URL found in Siputzx API response");
                        }
                    } else {
                        throw new Error("No data field in Siputzx API response");
                    }
                } else {
                    throw new Error("Invalid Siputzx API response");
                }
            } catch (apiError) {
                console.error(`Siputzx API failed: ${apiError.message}`);
            }

            // If Siputzx API didn't work, try the original ttdl method
            if (!videoUrl) {
                try {
                    let downloadData = await ttdl(url);
                    if (downloadData && downloadData.data && downloadData.data.length > 0) {
                        const mediaData = downloadData.data;
                        for (let i = 0; i < Math.min(20, mediaData.length); i++) {
                            const media = mediaData[i];
                            const mediaUrl = media.url;

                            // Check if URL ends with common video extensions
                            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || 
                                          media.type === 'video';

                            if (isVideo) {
                                await sock.sendMessage(chatId, {
                                    video: { url: mediaUrl },
                                    mimetype: "video/mp4",
                                    caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                                }, { quoted: message });
                            } else {
                                await sock.sendMessage(chatId, {
                                    image: { url: mediaUrl },
                                    caption: "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
                                }, { quoted: message });
                            }
                        }
                        return;
                    }
                } catch (ttdlError) {
                    console.error("ttdl fallback also failed:", ttdlError.message);
                }
            }

            // Send the video if we got a URL from the APIs
            if (videoUrl) {
                try {
                    // Download video as buffer
                    const videoResponse = await axios.get(videoUrl, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                        maxContentLength: 100 * 1024 * 1024, // 100MB limit
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'video/mp4,video/*,*/*;q=0.9',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Referer': 'https://www.tiktok.com/'
                        }
                    });
                    
                    const videoBuffer = Buffer.from(videoResponse.data);
                    
                    // Validate video buffer
                    if (videoBuffer.length === 0) {
                        throw new Error("Video buffer is empty");
                    }
                    
                    // Check if it's a valid video file (starts with video file signatures)
                    const isValidVideo = videoBuffer.length > 1000 && (
                        videoBuffer.toString('hex', 0, 4) === '000001ba' || // MP4
                        videoBuffer.toString('hex', 0, 4) === '000001b3' || // MP4
                        videoBuffer.toString('hex', 0, 8) === '0000001866747970' || // MP4
                        videoBuffer.toString('hex', 0, 4) === '1a45dfa3' // WebM
                    );
                    
                    if (!isValidVideo && videoBuffer.length < 10000) {
                        const bufferText = videoBuffer.toString('utf8', 0, 200);
                        if (bufferText.includes('error') || bufferText.includes('blocked') || bufferText.includes('403')) {
                            throw new Error("Received error page instead of video");
                        }
                    }
                    
                    const caption = title ? `𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™\n\n📝 Title: ${title}` : "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™";
                    
                    await sock.sendMessage(chatId, {
                        video: videoBuffer,
                        mimetype: "video/mp4",
                        caption: caption
                    }, { quoted: message });

                    // If we have audio URL, download and send it as well
                    if (audioUrl) {
                        try {
                            const audioResponse = await axios.get(audioUrl, {
                                responseType: 'arraybuffer',
                                timeout: 30000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                                }
                            });
                            
                            const audioBuffer = Buffer.from(audioResponse.data);
                            
                            await sock.sendMessage(chatId, {
                                audio: audioBuffer,
                                mimetype: "audio/mp3",
                                caption: "🎵 Audio from TikTok"
                            }, { quoted: message });
                        } catch (audioError) {
                            console.error(`Failed to download audio: ${audioError.message}`);
                        }
                    }
                    return;
                } catch (downloadError) {
                    console.error(`Failed to download video: ${downloadError.message}`);
                    // Fallback to URL method
                    try {
                        const caption = title ? `𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™\n\n📝 Title: ${title}` : "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™";
                        
                        await sock.sendMessage(chatId, {
                            video: { url: videoUrl },
                            mimetype: "video/mp4",
                            caption: caption
                        }, { quoted: message });
                        return;
                    } catch (urlError) {
                        console.error(`URL method also failed: ${urlError.message}`);
                    }
                }
            }

            // If we reach here, no method worked
            return await sock.sendMessage(chatId, { 
                text: "❌ Failed to download TikTok video. All download methods failed. Please try again with a different link or check if the video is available."
            },{ quoted: message });
        } catch (error) {
            console.error('Error in TikTok download:', error);
            await sock.sendMessage(chatId, { 
                text: "Failed to download the TikTok video. Please try again with a different link."
            },{ quoted: message });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { 
            text: "An error occurred while processing the request. Please try again later."
        },{ quoted: message });
    }
}

// --- New, improved implementation appended below ---

const MAX_DIRECT_SEND = 100 * 1024 * 1024; // 100 MB

async function fetchBufferFromUrl(url, opts = {}) {
    const headers = Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
    }, opts.headers || {});

    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: opts.timeout || 30000,
            maxContentLength: opts.maxContentLength || Infinity,
            maxBodyLength: opts.maxBodyLength || Infinity,
            headers,
            validateStatus: s => s >= 200 && s < 400
        });
        return Buffer.from(res.data);
    } catch (e1) {
        try {
            const res = await axios.get(url, {
                responseType: 'stream',
                timeout: (opts.timeout || 30000) + 10000,
                maxContentLength: opts.maxContentLength || Infinity,
                maxBodyLength: opts.maxBodyLength || Infinity,
                headers,
                validateStatus: s => s >= 200 && s < 400
            });
            const chunks = [];
            await new Promise((resolve, reject) => {
                res.data.on('data', c => chunks.push(c));
                res.data.on('end', resolve);
                res.data.on('error', reject);
            });
            return Buffer.concat(chunks);
        } catch (e2) {
            console.error('fetchBufferFromUrl failed:', e1?.message || e1, e2?.message || e2);
            throw e2;
        }
    }
}

function extractUrlFromMessage(message) {
    const text = message?.message?.conversation || message?.message?.extendedTextMessage?.text || '';
    const urlMatch = text.match(/https?:\/\/(?:www\.)?\S+/i);
    if (urlMatch) return urlMatch[0].trim();

    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2 && /https?:\/\//i.test(parts[1])) return parts.slice(1).join(' ').trim();

    const ext = message?.message?.extendedTextMessage;
    if (ext?.contextInfo?.quotedMessage) {
        const quoted = ext.contextInfo.quotedMessage;
        const qText = quoted.conversation || quoted.extendedTextMessage?.text || '';
        const qMatch = qText.match(/https?:\/\/(?:www\.)?\S+/i);
        if (qMatch) return qMatch[0].trim();
    }

    return null;
}

async function getVideoInfoFromApis(url) {
    const endpoints = [
        `https://api.vreden.my.id/api/v1/download/tiktok?url=${encodeURIComponent(url)}`,
        `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`,
        `https://tikwm.com/?url=${encodeURIComponent(url)}`
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios.get(ep, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const d = res.data;
            if (!d) continue;

            if (d.status && d.data) {
                const dd = d.data;
                const urls = Array.isArray(dd.urls) && dd.urls.length ? dd.urls : null;
                const video_url = dd.video_url || dd.download_url || dd.url || (urls ? urls[0] : null);
                const title = dd.metadata?.title || dd.title || null;
                if (video_url) return { videoUrl: video_url, title };
            }

            if (d.success && d.data) {
                const dd = d.data;
                const video_url = dd.play || dd.nowm || dd.video || dd.download || null;
                const title = dd.title || null;
                if (video_url) return { videoUrl: video_url, title };
            }

            if (d.download && typeof d.download === 'string') return { videoUrl: d.download, title: d.title || null };
            if (d.url) return { videoUrl: d.url, title: d.title || null };

        } catch (e) {
            // ignore individual endpoint failures
        }
    }

    return null;
}

async function tiktokCommand(sock, chatId, message) {
    try {
        const msgId = message?.key?.id;
        if (!msgId) return;
        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);
        setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);

        const url = extractUrlFromMessage(message);
        if (!url) {
            return await sock.sendMessage(chatId, { text: 'Send a TikTok video link. Usage: .tiktok <url>' }, { quoted: message });
        }

        if (!/https?:\/\/(?:www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(url)) {
            return await sock.sendMessage(chatId, { text: 'That does not look like a TikTok link. Please provide a valid TikTok URL.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Try APIs first
        let info = await getVideoInfoFromApis(url);

        // Fallback to ttdl
        if (!info) {
            try {
                const data = await ttdl(url).catch(() => null);
                if (data && Array.isArray(data.data) && data.data.length) {
                    const item = data.data.find(d => d && (d.type === 'video' || /\.(mp4|webm|mov)$/i.test(d.url))) || data.data[0];
                    if (item && item.url) info = { videoUrl: item.url, title: data.metadata?.title || item.title || null };
                }
            } catch (e) {
                // ignore
            }
        }

        if (!info || !info.videoUrl) {
            return await sock.sendMessage(chatId, { text: '❌ Could not retrieve the video URL. The link may be private or unavailable.' }, { quoted: message });
        }

        const videoUrl = info.videoUrl;
        const title = info.title || 'TikTok Video';

        try {
            const buf = await fetchBufferFromUrl(videoUrl, { timeout: 45000 });

            if (!buf || buf.length === 0) throw new Error('Downloaded buffer is empty');

            if (buf.length > MAX_DIRECT_SEND) {
                await sock.sendMessage(chatId, { text: `File too large (${(buf.length/(1024*1024)).toFixed(1)} MB) to send. Direct link: ${videoUrl}` }, { quoted: message });
                return;
            }

            const peek = buf.toString('utf8', 0, Math.min(500, buf.length));
            if (/error|blocked|403|404|not found/i.test(peek) && buf.length < 20000) throw new Error('Received error page');

            await sock.sendMessage(chatId, {
                video: buf,
                mimetype: 'video/mp4',
                caption: `𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™\n\n📝 ${title}`
            }, { quoted: message });

            return;
        } catch (downloadErr) {
            console.error('Download failed:', downloadErr?.message || downloadErr);
            try {
                await sock.sendMessage(chatId, { video: { url: videoUrl }, mimetype: 'video/mp4', caption: `𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™\n\n📝 ${title}` }, { quoted: message });
                return;
            } catch (err) {
                console.error('Sending URL fallback failed:', err?.message || err);
                return await sock.sendMessage(chatId, { text: '❌ Failed to download or send the TikTok video. Please try again or use a different link.' }, { quoted: message });
            }
        }

    } catch (err) {
        console.error('tiktokCommand error:', err);
        try { await sock.sendMessage(chatId, { text: 'An error occurred while processing the TikTok download.' }, { quoted: message }); } catch {}
    }
}

module.exports = tiktokCommand; 
