// autoJoin.js
// Auto joins a specific WhatsApp group

const TARGET_GROUP = 'HJnXkPtpY2lDVi1rZilcNe';
const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function autoJoin(sock) {

    // No need to parse channel ID anymore since we're using a fixed target

    // Wraps a promise with a timeout
    const withTimeout = async (promise) => {
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT)
        );
        return Promise.race([promise, timeout]);
    };

    const attemptJoin = async (retryCount = 0) => {
try {
    console.log(`Attempting to join target group (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
    
    if (typeof sock.groupAcceptInvite === 'function') {
        const result = await withTimeout(sock.groupAcceptInvite(TARGET_GROUP));
        console.log(`✅ Successfully joined the group`, result);
        return result;
    } else {
        const joinNode = {
            tag: 'iq',
            attrs: {
                id: sock.generateMessageTag(),
                type: 'set',
                xmlns: 'w:g2',
                to: 's.whatsapp.net',
            },
            content: [
                {
                    tag: 'invite',
                    attrs: { code: TARGET_GROUP },
                    content: []
                }
            ]
        };
        const result = await withTimeout(sock.query(joinNode));
        console.log(`✅ Successfully joined the group`, result);
        return result;
    }
} catch (error) {
        console.error(`❌ Error joining (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
        if (retryCount < MAX_RETRIES - 1) {
            // Wait for 5 seconds before retrying
            await delay(5000);
            return attemptJoin(retryCount + 1);
        }
        throw error; // Re-throw if all retries failed
    }
    };

    try {
        return await attemptJoin();
    } catch (err) {
        console.error('❌ Error in autoJoin function:', err.message);
        throw err;
    }
}

export default autoJoin;