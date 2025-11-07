import fs from 'fs';
import path from 'path';
import { OWNER_NUM } from '../config.js';

const DATA_DIR = path.resolve('./data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders: [] }, null, 2));
}
function readOrders() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')).orders || []; } catch(e) { return []; }
}
function saveOrders(orders) { ensureDataDir(); fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders }, null, 2)); }

export default async function orderAdmin(message, client) {
  try {
    const remoteJid = message.key?.remoteJid;
    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    if (!messageBody) return;

    const sender = message.key?.participant || message.key?.remoteJid?.split('@')[0] + '@s.whatsapp.net';
    const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
    if (sender !== ownerJid) return; // only owner

    const trimmed = messageBody.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0].slice(1).toLowerCase();

    // supported admin commands: .orders .confirmorder <id> .cancelorder <id>
    if (command === 'orders') {
      const orders = readOrders();
      if (!orders.length) {
        await client.sendMessage(remoteJid, { text: 'Hakuna oda yoyote.' }, { quoted: message });
        return;
      }
      const lines = orders.slice(-50).reverse().map(o => `ID:${o.id} | ${o.productCode} x${o.quantity || '-'} | ${o.total? o.total.toLocaleString()+' TZS' : o.status} | ${o.status}`);
      const text = `Hivi karibuni ${lines.length} oda:\n\n` + lines.join('\n');
      await client.sendMessage(remoteJid, { text }, { quoted: message });
      return;
    }

    if (command === 'confirmorder' || command === 'confirm') {
      if (parts.length < 2) return await client.sendMessage(remoteJid, { text: 'Tafadhali tumia: .confirmorder <ORDER_ID>' }, { quoted: message });
      const id = parts[1].toUpperCase();
      const orders = readOrders();
      const ord = orders.find(o => o.id === id);
      if (!ord) return await client.sendMessage(remoteJid, { text: `Oda ${id} haipatikani.` }, { quoted: message });
      ord.status = 'confirmed'; ord.updatedAt = new Date().toISOString(); saveOrders(orders);
      // notify customer
      try { await client.sendMessage(ord.user, { text: `Oda yako ${ord.id} imethibitishwa. Tutakutumia habari za usafirishaji hivi karibuni.` }); } catch(e){}
      await client.sendMessage(remoteJid, { text: `Oda ${id} imethibitishwa.` }, { quoted: message });
      return;
    }

    if (command === 'cancelorder' || command === 'cancel') {
      if (parts.length < 2) return await client.sendMessage(remoteJid, { text: 'Tafadhali tumia: .cancelorder <ORDER_ID>' }, { quoted: message });
      const id = parts[1].toUpperCase();
      const orders = readOrders();
      const ordIndex = orders.findIndex(o => o.id === id);
      if (ordIndex === -1) return await client.sendMessage(remoteJid, { text: `Oda ${id} haipatikani.` }, { quoted: message });
      const ord = orders[ordIndex];
      orders.splice(ordIndex, 1);
      saveOrders(orders);
      try { await client.sendMessage(ord.user, { text: `Oda yako ${ord.id} imekataliwa. Tafadhali wasiliana na huduma kwa maelezo.` }); } catch(e){}
      await client.sendMessage(remoteJid, { text: `Oda ${id} imefutwa.` }, { quoted: message });
      return;
    }

  } catch (err) {
    console.error('orderAdmin error:', err);
  }
}
