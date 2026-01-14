
const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
	timeout: 60000,
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Accept': 'application/json, text/plain, */*'
	}
};

async function tryRequest(getter, attempts = 3) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await getter();
		} catch (err) {
			lastError = err;
			if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
		}
	}
	throw lastError;
}

async function getAudioByUrl(youtubeUrl) {
	// Single-source audio fetch using Okatsu endpoint (reliable single API)
	const apiUrl = `https://api.vreden.my.id/api/v1/download/play/audio?query=${encodeURIComponent(youtubeUrl)}`;
	const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
	// Support multiple response shapes returned by the API
	if (res?.data?.result?.mp3) return { download: res.data.result.mp3, title: res.data.result.title };
	if (res?.data?.url) return { download: res.data.url, title: res.data.title || '' };
	if (res?.data?.result?.download) return res.data.result;
	throw new Error('Audio API returned no download');
}

async function playCommand(sock, chatId, message) {
	try {
		const raw = message.message?.conversation?.trim() || message.message?.extendedTextMessage?.text?.trim() || '';
		const args = raw.split(/\s+/).slice(1).join(' ').trim();

		if (!args) {
			await sock.sendMessage(chatId, { text: 'Usage: .play <YouTube link or search terms>' }, { quoted: message });
			return;
		}

		let input = args;
		let title = '';
		let thumbnail = '';

		if (!input.startsWith('http://') && !input.startsWith('https://')) {
			const { videos } = await yts(input);
			if (!videos || videos.length === 0) {
				await sock.sendMessage(chatId, { text: 'No results found for your query.' }, { quoted: message });
				return;
			}
			input = videos[0].url;
			title = videos[0].title;
			thumbnail = videos[0].thumbnail;
		}

		// Send thumbnail/info while fetching
		try {
			const captionTitle = title || input;
			if (thumbnail) {
				await sock.sendMessage(chatId, { image: { url: thumbnail }, caption: `*${captionTitle}*\nDownloading audio...` }, { quoted: message });
			} else {
				await sock.sendMessage(chatId, { text: `Downloading audio for: ${captionTitle}` }, { quoted: message });
			}
		} catch (e) { console.error('[PLAY] thumb/info error:', e?.message || e); }

		// validate youtube id
		const urls = input.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
		if (!urls) {
			await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
			return;
		}

		let audioData;
		try {
			audioData = await getAudioByUrl(input);
		} catch (e) {
			throw new Error('Audio API failed: ' + (e?.message || e));
		}

		const fileName = (audioData.title || title || 'audio').replace(/[\\/:*?"<>|]/g, '').trim() + '.mp3';

		// Download the audio directly from the API and send as binary
		const downloadUrl = audioData.download;
		let audioBuffer;
		try {
			const res = await tryRequest(() => axios.get(downloadUrl, { ...AXIOS_DEFAULTS, responseType: 'arraybuffer', timeout: 120000 }));
			const contentLength = parseInt(res.headers?.['content-length'] || 0, 10);
			const MAX_BYTES = 25 * 1024 * 1024; // 25 MB safety limit
			if (contentLength && contentLength > MAX_BYTES) {
				await sock.sendMessage(chatId, { text: `File is too large to upload (${(contentLength / (1024*1024)).toFixed(2)} MB). Sending a download link instead:\n${downloadUrl}` }, { quoted: message });
				return;
			}
			audioBuffer = Buffer.from(res.data);
		} catch (e) {
			console.error('[PLAY] download error:', e?.message || e);
			// Fallback: send the direct URL if buffer download fails
			await sock.sendMessage(chatId, { text: 'Failed to download audio file directly, sending link instead.' }, { quoted: message });
			await sock.sendMessage(chatId, { text: downloadUrl }, { quoted: message });
			return;
		}

		await sock.sendMessage(chatId, {
			audio: audioBuffer,
			mimetype: 'audio/mpeg',
			fileName
		}, { quoted: message });

	} catch (error) {
		console.error('[PLAY] Command Error:', error?.message || error);
		await sock.sendMessage(chatId, { text: 'Audio download failed: ' + (error?.message || 'Unknown error') }, { quoted: message });
	}
}

module.exports = playCommand;

