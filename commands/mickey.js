import axios from 'axios';
import { BOT_NAME, OWNER_NAME } from '../config.js';

// ===== CONFIGURATION =====
const MICKEY_CONFIG = {
    apiUrl: 'https://apis.davidcyriltech.my.id/ai/chatbot',
    timeout: 10000,
    maxQueryLength: 500
};

/**
 * Extracts user query from message
 * @param {Object} message - WhatsApp message object
 * @returns {string} Extracted query or empty string
 */
function extractQuery(message) {
    try {
        const body =
            message.message?.extendedTextMessage?.text ||
            message.message?.conversation ||
            '';
        
        const parts = body.trim().split(/\s+/);
        return parts.slice(1).join(' ');
    } catch (error) {
        console.warn('⚠️ Error extracting query:', error.message);
        return '';
    }
}

/**
 * Validates query before sending to API
 * @param {string} query - User's query
 * @returns {Object} Validation result {valid: boolean, error?: string}
 */
function validateQuery(query) {
    if (!query || query.trim().length === 0) {
        return {
            valid: false,
            error: '❌ Please provide a question.\nUsage: `.mickey What is the capital of Cameroon?`'
        };
    }

    if (query.length > MICKEY_CONFIG.maxQueryLength) {
        return {
            valid: false,
            error: `❌ Question too long (max ${MICKEY_CONFIG.maxQueryLength} characters)`
        };
    }

    return { valid: true };
}

/**
 * Fetches answer from AI API
 * @param {string} query - User's query
 * @returns {Promise<string>} AI response
 */
async function fetchAIAnswer(query) {
    try {
        const response = await axios.get(MICKEY_CONFIG.apiUrl, {
            params: { query },
            timeout: MICKEY_CONFIG.timeout
        });

        const { data } = response;

        if (!data?.success || !data?.result) {
            throw new Error('No answer received from API');
        }

        return data.result;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('API request timeout');
        }
        if (error.response?.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
        }
        throw new Error(error.message || 'Failed to fetch answer from AI');
    }
}

/**
 * Formats the AI response message
 * @param {string} query - Original query
 * @param {string} answer - AI's answer
 * @returns {string} Formatted message
 */
function formatResponse(query, answer) {
    return `${answer}`;
}

/**
 * Main Mickey AI command handler
 * @param {Object} message - WhatsApp message object
 * @param {Object} client - WhatsApp client instance
 */
export async function mickey(message, client) {
    let remoteJid = null;

    try {
        // Validate and extract JID
        remoteJid = message?.key?.remoteJid;
        if (!remoteJid || typeof remoteJid !== 'string') {
            console.error('❌ Invalid remoteJid');
            return;
        }

        // Extract and validate query
        const query = extractQuery(message);
        const validation = validateQuery(query);

        if (!validation.valid) {
            await client.sendMessage(remoteJid, {
                text: validation.error,
                quoted: message
            });
            return;
        }

        console.log(`🤖 Processing Mickey query: "${query}"`);

        // Send thinking message
        await client.sendMessage(remoteJid, {
            text: `⏳ Thinking…`,
            quoted: message
        });

        // Fetch answer from AI
        const answer = await fetchAIAnswer(query);

        // Format and send response
        const response = formatResponse(query, answer);
        await client.sendMessage(remoteJid, {
            text: response,
            quoted: message
        });

        console.log(`✅ Mickey response sent successfully`);

    } catch (error) {
        console.error('❌ Error in mickey command:', error.message);

        const errorMessage = `❌ Failed to get answer: ${error.message}`;

        if (remoteJid) {
            try {
                await client.sendMessage(remoteJid, {
                    text: errorMessage,
                    quoted: message
                });
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError.message);
            }
        }
    }
}

export default mickey;
