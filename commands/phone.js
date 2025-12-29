const axios = require('axios');

/**
 * Phone Information Command
 * Fetches phone specifications from GSMarena API
 * Sends the phone image first (like WhatsApp ads), then specs as caption
 */
module.exports = async function (sock, chatId, message, phoneQuery) {
    try {
        // Validate input
        if (!phoneQuery || phoneQuery.trim() === '') {
            await sock.sendMessage(chatId, 
                { 
                    text: `╭━━━━━━━━━━━━━━━━━━━━━━━━╮
       📱 PHONE INFORMATION
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

*Usage:* .phone <device name>

*Examples:*
  • .phone iPhone 15 Pro
  • .phone Samsung Galaxy S24
  • .phone Google Pixel 8
  • .phone Xiaomi 14 Ultra

_Get detailed specs including processor, camera, battery, and more!_` 
                }, 
                { quoted: message }
            );
            return;
        }

        // Show searching message
        await sock.sendMessage(chatId, 
            { text: '🔍 Searching phone information...' }, 
            { quoted: message }
        );

        let response = null;

        try {
            // Retry logic
            const maxAttempts = 3;
            let attempt = 0;

            while (attempt < maxAttempts) {
                try {
                    attempt += 1;
                    response = await axios.get(
                        `https://okatsu-rolezapiiz.vercel.app/tools/gsmarena?query=${encodeURIComponent(phoneQuery.trim())}`,
                        { timeout: 10000 }
                    );

                    if (response.status >= 200 && response.status < 300) {
                        break;
                    }
                } catch (err) {
                    if (attempt >= maxAttempts) throw err;
                    await new Promise(res => setTimeout(res, 500 * attempt));
                }
            }

            // Validate API response
            if (!response?.data?.status || !response.data.result) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Phone Not Found*\n\nNo information found for *"${phoneQuery.trim()}"*.\n\nTips:\n• Use the full model name (e.g., Samsung Galaxy A05)\n• Try different spelling`
                }, { quoted: message });
                return;
            }

            const result = response.data.result;
            const specs = result.specs || {};

            // Safe accessor
            const getSpec = (category, key) => {
                const value = specs[category]?.[key];
                return value ? String(value).trim() : 'N/A';
            };

            // Extract fields
            const name = (result.phoneName || 'N/A').trim();

            let brand = 'N/A';
            const models = getSpec('Misc', 'Models');
            if (models !== 'N/A') {
                brand = models.split(',')[0].trim().split(' ')[0];
            } else if (name !== 'N/A') {
                brand = name.split(' ')[0];
            }

            const release = getSpec('Launch', 'Announced') || 'N/A';
            const memory = getSpec('Memory', 'Internal') || 'N/A';
            const processor = getSpec('Platform', 'Chipset') || getSpec('Platform', 'CPU') || 'N/A';

            let camera = 'N/A';
            const camOrder = ['Quad', 'Triple', 'Dual', 'Single'];
            for (const key of camOrder) {
                const val = getSpec('Main Camera', key);
                if (val !== 'N/A') {
                    camera = val.split('\n')[0].trim();
                    break;
                }
            }
            if (camera === 'N/A') camera = getSpec('Main Camera', 'Features') || 'N/A';

            const battery = getSpec('Battery', 'Type') || 'N/A';
            const charging = getSpec('Battery', 'Charging') || 'N/A';

            const displayType = getSpec('Display', 'Type');
            const displaySize = getSpec('Display', 'Size');
            const display = (displayType !== 'N/A' && displaySize !== 'N/A')
                ? `${displayType}, ${displaySize}`
                : (displayType || displaySize || 'N/A');

            const weight = getSpec('Body', 'Weight') || 'N/A';
            const colors = getSpec('Misc', 'Colors') || 'N/A';

            let price = 'N/A';
            if (result.prices?.EUR) {
                price = `≈ €${result.prices.EUR}`;
            } else {
                const miscPrice = getSpec('Misc', 'Price');
                if (miscPrice !== 'N/A') price = miscPrice;
            }

            // Specifications list
            const specsList = [
                { label: '📛 Device',    value: name },
                { label: '🏢 Brand',      value: brand },
                { label: '📅 Release',    value: release },
                { label: '💾 Memory',     value: memory },
                { label: '🖥️ Processor', value: processor },
                { label: '📷 Camera',     value: camera },
                { label: '🔋 Battery',    value: battery },
                { label: '🔌 Charging',   value: charging },
                { label: '📱 Display',    value: display },
                { label: '⚖️ Weight',     value: weight },
                { label: '🎨 Colors',     value: colors },
                { label: '💵 Price',      value: price }
            ];

            // Build specs text using safe concatenation
            let phoneInfo = "╭━━━━━━━━━━━━━━━━━━━━━━━━╮\n";
            phoneInfo += "       📱 *PHONE INFORMATION*\n";
            phoneInfo += "╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

            specsList.forEach(item => {
                if (item.value && item.value !== 'N/A' && item.value.trim() !== '') {
                    phoneInfo += item.label + ": *" + item.value + "*\n";
                }
            });

            phoneInfo += "\n╭━━━━━━━━━━━━━━━━━━━━━━━━╮\n";
            phoneInfo += "    ✨ Powered by GSMArena ✨\n";
            phoneInfo += "╰━━━━━━━━━━━━━━━━━━━━━━━━╯";

            // Check if phone image exists
            if (result.imageUrl) {
                // Send image FIRST with full specs as caption (exactly like WhatsApp ads)
                await sock.sendMessage(chatId, {
                    image: { url: result.imageUrl },
                    caption: phoneInfo,
                    jpegThumbnail: null // Optional: let WhatsApp generate thumbnail
                }, { quoted: message });
            } else {
                // Fallback: send as text only if no image
                await sock.sendMessage(chatId, { text: phoneInfo }, { quoted: message });
            }

        } catch (apiError) {
            console.error('GSMarena API Error:', apiError.message || apiError);

            let errorMsg = '⚠️ *Failed to fetch data*\nPlease check your spelling or try again later.';

            if (apiError.code === 'ECONNABORTED') {
                errorMsg = '⏱️ *Timeout*\nThe API took too long. Please try again.';
            } else if (apiError.response?.status) {
                errorMsg = `⚠️ *API Error (${apiError.response.status})*\nTry a different query.`;
            }

            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
        }

    } catch (error) {
        console.error('Phone Command Error:', error.message || error);
        await sock.sendMessage(chatId, {
            text: '❌ *Error*\nSomething went wrong. Please try again later.'
        }, { quoted: message });
    }
};

// Command metadata
module.exports.command = 'phone';
module.exports.description = 'Get phone specifications from GSMarena';