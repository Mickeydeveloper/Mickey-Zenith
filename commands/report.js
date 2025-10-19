import fs from 'fs/promises'; // For async file operations
import path from 'path';

// Utility to generate a timestamp for logging and filenames
const getTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Async function to report a user and log details to a file
async function report(
  sock,
  status,
  jid = '255612130873@s.whatsapp.net', // Updated to target number
  messages = [],
  reportFilePath = `report_${getTimestamp()}.json` // Default report file name with timestamp
) {
  // Input validation
  if (!status) {
    console.error('❌ Status is required for reporting.');
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    console.warn('⚠️ No messages provided for reporting.');
  }

  console.log(`📝 Attempting to report user: ${jid}`);

  // Prepare report data for logging
  const reportData = {
    jid,
    status,
    timestamp: new Date().toISOString(),
    messages: messages.map((msg) => ({
      id: msg.key?.id || '3EB0D0E285C4D921620773',
      timestamp: msg.messageTimestamp?.low || msg.t || Date.now(),
    })),
  };

  // Write report to file
  try {
    await fs.writeFile(
      path.resolve(reportFilePath),
      JSON.stringify(reportData, null, 2),
      'utf-8'
    );
    console.log(`📄 Report saved to ${reportFilePath}`);
  } catch (err) {
    console.error('❌ Failed to write report to file:', err.message);
  }

  // Construct the spam report node
  const spamNode = {
    tag: 'iq',
    attrs: {
      id: sock.generateMessageTag(),
      type: 'set',
      xmlns: 'spam',
      to: 's.whatsapp.net',
    },
    content: [
      {
        tag: 'spam_list',
        attrs: {
          spam_flow: 'account_info_report',
        },
        content: messages.map((msg) => {
          const msgId = msg.key?.id || '3EB0D0E285C4D921620773'; // Fallback ID
          const msgTimestamp = msg.messageTimestamp?.low || msg.t || Date.now();

          return {
            tag: 'message',
            attrs: {
              id: msgId,
              t: msgTimestamp,
              type: 'text',
              from: jid,
            },
            content: [
              {
                tag: 'reporting',
                attrs: {},
                content: [
                  {
                    tag: 'reporting_validation',
                    attrs: {},
                    content: [
                      {
                        tag: 'reporting_tag',
                        attrs: {
                          id: msgId,
                          ts_s: msgTimestamp,
                        },
                        content: new Uint8Array(20), // Placeholder for binary data
                      },
                    ],
                  },
                ],
              },
              {
                tag: 'raw',
                attrs: { v: '2' },
                content: new Uint8Array(32), // Placeholder for binary data
              },
            ],
          };
        }),
      },
    ],
  };

  // Retry logic (up to 3 attempts)
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      const result = await sock.query(spamNode);
      console.log(`✅ User ${jid} reported successfully:`, result);
      return result; // Exit on success
    } catch (err) {
      attempts++;
      console.error(`❌ Attempt ${attempts}/${maxAttempts} failed to report user:`, err.message);
      if (attempts === maxAttempts) {
        console.error('❌ Max retry attempts reached. Report failed.');
        throw err; // Rethrow after max attempts
      }
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
    }
  }
}

// Example usage (for testing, can be removed in production)
async function example() {
  const mockSock = {
    generateMessageTag: () => `tag_${Date.now()}`,
    query: async (node) => {
      // Simulate successful response
      return { status: 'success', node };
    },
  };

  const mockMessages = [
    { key: { id: 'MSG1' }, messageTimestamp: { low: Date.now() / 1000 } },
    { key: { id: 'MSG2' }, messageTimestamp: { low: Date.now() / 1000 } },
  ];

  await report(mockSock, 'spam', '255612130873@s.whatsapp.net', mockMessages, 'report_test.json');
}

// Uncomment to test: example();

export default report;