import statusLike from './commands/statuslike.js';

const mockClient = {
  sendMessage: async (jid, msg) => {
    console.log('mockClient.sendMessage called with', jid, msg);
    return { ok: true };
  }
};

async function run() {
  // mock status message
  const message = {
    key: {
      remoteJid: 'status@broadcast',
      participant: '12345@s.whatsapp.net',
      fromMe: false
    }
  };

  await statusLike(message, mockClient, true);
}

run().then(() => console.log('done')).catch(err => console.error('test failed', err));
