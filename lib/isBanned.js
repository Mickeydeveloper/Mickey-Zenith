const fs = require('fs');

/**
 * Check whether a user is banned. Supports full JIDs and plain numbers.
 * Normalizes IDs to the numeric portion before comparing.
 */
function isBanned(userId) {
    try {
        const bannedRaw = JSON.parse(fs.readFileSync('./data/banned.json', 'utf8')) || [];
        const bannedUsers = Array.isArray(bannedRaw) ? bannedRaw : Object.keys(bannedRaw);

        // Normalize a JID or other id to its phone-number-like portion
        const normalize = id => String(id || '').split(':')[0].split('@')[0].trim();
        const target = normalize(userId);

        // Build normalized set for faster lookup
        const normalizedSet = new Set(bannedUsers.map(normalize));

        const matched = normalizedSet.has(target);
        if (matched) {
            console.log(`[Ban] User ${userId} (normalized: ${target}) is banned.`);
        }
        return matched;
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

// Export the function itself (default) and also attach as a named property for compatibility
module.exports = isBanned;
module.exports.isBanned = isBanned; 