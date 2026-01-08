// Simple local tester for autoreply feature
const fs = require('fs');
const path = require('path');

const { handleAutoreply, autoreplyCommand } = require('../commands/autoreply');

// Mock sock with sendMessage that prints to console
const mockSock = {
  sendMessage: async (chatId, message, extra) => {
    console.log('[mockSock] sendMessage called ->', chatId, message, extra ? '(extra provided)' : '');
    return Promise.resolve({ ok: true });
  }
};

async function runTests() {
  const dataFile = path.join(__dirname, '..', 'data', 'autoreply.json');
  // Ensure enabled
  fs.writeFileSync(dataFile, JSON.stringify({ enabled: true }, null, 2));
  console.log('[test] set autoreply enabled in', dataFile);

  // Simulate incoming private message
  const incoming = {
    key: { remoteJid: '1234567890@s.whatsapp.net', id: 'TESTMSG1', fromMe: false },
    message: { conversation: 'Hello bot, how are you?' }
  };

  console.log('[test] calling handleAutoreply...');
  await handleAutoreply(mockSock, incoming);

  // Test: name query in English
  const nameEn = {
    key: { remoteJid: '1234567890@s.whatsapp.net', id: 'TESTMSG2', fromMe: false },
    message: { conversation: "What's your name?" }
  };
  console.log('[test] calling handleAutoreply (name query EN)...');
  await handleAutoreply(mockSock, nameEn);

  // Test: name query in Swahili
  const nameSw = {
    key: { remoteJid: '1234567890@s.whatsapp.net', id: 'TESTMSG3', fromMe: false },
    message: { conversation: 'Jina lako nani?' }
  };
  console.log('[test] calling handleAutoreply (name query SW)...');
  await handleAutoreply(mockSock, nameSw);

  // Test: about-me request
  const aboutMe = {
    key: { remoteJid: '1234567890@s.whatsapp.net', id: 'TESTMSG4', fromMe: false },
    message: { conversation: 'Tell me about me' }
  };
  console.log('[test] calling handleAutoreply (about-me)...');
  await handleAutoreply(mockSock, aboutMe);

  // Test toggling via command as owner (simulate message from owner by setting fromMe=true)
  const ownerCmd = {
    key: { remoteJid: 'owner@s.whatsapp.net', id: 'CMD1', fromMe: true },
    message: { conversation: '.autoreply status' }
  };

  console.log('[test] calling autoreplyCommand as owner (status)...');
  await autoreplyCommand(mockSock, ownerCmd.key.remoteJid, ownerCmd);
}

runTests().catch(e => console.error('[test] error', e));
