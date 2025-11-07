import fs from 'fs';
import path from 'path';
import pkg from 'bailey';
import { OWNER_NUM } from '../config.js';
import notifyOwner from '../utils/ownerNotify.js';

const { downloadMediaMessage } = pkg;

const DATA_DIR = path.resolve('./data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders: [] }, null, 2));
}

function readOrders() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(raw).orders || [];
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  ensureDataDir();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders }, null, 2));
}

function generateOrderId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function parseOrderText(text) {
  // Expected formats (examples):
  // .order GB10 KWA SHILLINGI 10000
  // .order GB10 10000
  const normalized = text.replace(/\s+/g, ' ').trim();
  const parts = normalized.split(' ');
  // remove command part
  if (parts.length < 2) return null;
  const cmd = parts[0];
  const rest = parts.slice(1).join(' ');

  // try regex for "CODE KWA SHILLINGI PRICE"
  const m = rest.match(/^(?<code>\w+)\s+(?:KWA\s+)?SHILLINGI\s+(?<price>[0-9,\.]+)/i);
  if (m && m.groups) {
    const code = m.groups.code;
    const price = Number(m.groups.price.replace(/[,]/g, '')) || 0;
    return { code, price };
  }

  // try simple: CODE PRICE
  const parts2 = rest.split(' ');
  if (parts2.length >= 2) {
    const code = parts2[0];
    const price = Number(parts2[1].replace(/[,]/g, '')) || 0;
    return { code, price };
  }

  return null;
}

export default async function orderCommand(message, client) {
  try {
    const remoteJid = message.key?.remoteJid;
    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    if (!messageBody) return;

    const trimmed = messageBody.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0].slice(1).toLowerCase(); // remove prefix like .

    if (!['order', 'qty', 'pay'].includes(command)) return; // not this command

    // common helpers
    const from = message.key?.participant || message.key?.remoteJid?.split('@')[0] + '@s.whatsapp.net';

    if (command === 'order') {
      // parse product and price
      const parsed = parseOrderText(trimmed);
      if (!parsed) {
        await client.sendMessage(remoteJid, { text: "Tafadhali tumia muundo: .order <CODE> KWA SHILLINGI <price> (mfano: .order GB10 KWA SHILLINGI 10000)" }, { quoted: message });
        return;
      }

      const orderId = generateOrderId();
      const order = {
        id: orderId,
        user: from,
        productCode: parsed.code.toUpperCase(),
        unitPrice: Number(parsed.price),
        quantity: null,
        total: null,
        status: 'awaiting_quantity',
        createdAt: new Date().toISOString(),
        screenshot: null
      };

      const orders = readOrders();
      orders.push(order);
      saveOrders(orders);

      const reply = `Oda imerekodiwa (ID: ${orderId})\n\n` +
                    `📦 Bidhaa: ${order.productCode}\n` +
                    `💸 Bei kwa kipande: ${order.unitPrice.toLocaleString()} TZS\n\n` +
                    `Tafadhali taja *idadi* unayotaka kwa kutumia: .qty ${orderId} <idadi>\n` +
                    `Mfano: .qty ${orderId} 2\n\n` +
                    `_Baada ya hapo utapokea jumla ya malipo na maelekezo ya jinsi ya kulipia (tuma screenshot baada ya kulipa)._`;

      await client.sendMessage(remoteJid, { text: reply }, { quoted: message });
      return;
    }

    if (command === 'qty') {
      // expected: .qty <orderId> <quantity>
      if (parts.length < 3) {
        await client.sendMessage(remoteJid, { text: 'Tafadhali tumia: .qty <ORDER_ID> <idadi> (mfano: .qty ABCD1234 2)' }, { quoted: message });
        return;
      }

      const orderId = parts[1].toUpperCase();
      const qty = parseInt(parts[2], 10) || 0;
      const orders = readOrders();
      const ord = orders.find(o => o.id === orderId && o.user === from);
      if (!ord) {
        await client.sendMessage(remoteJid, { text: `Oda ${orderId} haikutumika na wewe au haipo.` }, { quoted: message });
        return;
      }
      if (qty <= 0) {
        await client.sendMessage(remoteJid, { text: 'Tafadhali weka idadi halali (>0).' }, { quoted: message });
        return;
      }

      ord.quantity = qty;
      ord.total = ord.unitPrice * qty;
      ord.status = 'awaiting_payment';
      ord.updatedAt = new Date().toISOString();
      saveOrders(orders);

      const payText = `Oda yako (ID: ${ord.id})\n\n` +
                      `📦 ${ord.productCode}\n` +
                      `✖️ Idadi: ${ord.quantity}\n` +
                      `💰 Jumla ya kulipa: ${ord.total.toLocaleString()} TZS\n\n` +
                      `Maelekezo ya malipo:\n` +
                      `1) Lipa kwa namba: *0722XXXXXX* (au akaunti nyingine iliyoelezwa)\n` +
                      `2) Baada ya kulipa, tuma screenshot ya malipo kama ujumbe ulioambatana na: .pay ${ord.id}\n\n` +
                      `_Tutakuthibitisha mara tu tukipokea screenshot._`;

      await client.sendMessage(remoteJid, { text: payText }, { quoted: message });
      return;
    }

    if (command === 'pay') {
      // expected: .pay <orderId>
      if (parts.length < 2) {
        await client.sendMessage(remoteJid, { text: 'Tafadhali tumia: .pay <ORDER_ID> (na ongeza screenshot/kielelezo kama picha kwenye ujumbe huu)' }, { quoted: message });
        return;
      }

      const orderId = parts[1].toUpperCase();
      const orders = readOrders();
      const ord = orders.find(o => o.id === orderId && o.user === from);
      if (!ord) {
        await client.sendMessage(remoteJid, { text: `Oda ${orderId} haikutumika na wewe au haipo.` }, { quoted: message });
        return;
      }

      // check if message has image (screenshot)
      const hasImage = !!(message.message && (message.message.imageMessage || message.message.documentMessage));
      if (!hasImage) {
        await client.sendMessage(remoteJid, { text: `Tafadhali ambatisha screenshot ya malipo kama picha au faili kisha tumia: .pay ${orderId}` }, { quoted: message });
        return;
      }

      // Attempt to download and save screenshot, then notify owner with image
      ord.status = 'paid_pending_confirmation';
      ord.updatedAt = new Date().toISOString();

      // ensure screenshots dir
      if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

      try {
        // find the media part in the message
        const mediaMessage = message.message.imageMessage || message.message.documentMessage || null;
        let savedPath = null;
        if (mediaMessage) {
          const buffer = await downloadMediaMessage({ message: message.message, client }, 'buffer', {});
          if (buffer && buffer.length) {
            // choose extension
            const mime = mediaMessage.mimetype || 'image/jpeg';
            const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
            savedPath = path.join(SCREENSHOTS_DIR, `${ord.id}.${ext}`);
            fs.writeFileSync(savedPath, buffer);
            ord.screenshot = { messageId: message.key?.id || null, from: from, receivedAt: new Date().toISOString(), path: savedPath };
          } else {
            ord.screenshot = { messageId: message.key?.id || null, from: from, receivedAt: new Date().toISOString() };
          }
        } else {
          ord.screenshot = { messageId: message.key?.id || null, from: from, receivedAt: new Date().toISOString() };
        }
      } catch (downloadErr) {
        console.error('Failed to download screenshot for order', ord.id, downloadErr);
        ord.screenshot = { messageId: message.key?.id || null, from: from, receivedAt: new Date().toISOString() };
      }

      saveOrders(orders);

      // Notify owner for manual confirmation (owner can verify screenshot)
      const ownerNotifyText = `*🧾 New Payment Submitted*\n\n` +
                              `Oda ID: ${ord.id}\n` +
                              `Mteja: ${ord.user}\n` +
                              `Bidhaa: ${ord.productCode}\n` +
                              `Idadi: ${ord.quantity}\n` +
                              `Jumla: ${ord.total?.toLocaleString() || 'unknown'} TZS\n` +
                              `Screenshot Message ID: ${ord.screenshot.messageId || 'n/a'}\n` +
                              `Tafadhali thibitisha na kusindika oda.`;

      // Send owner a text + attach screenshot if available
      (async () => {
        try {
          const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
          if (ord.screenshot && ord.screenshot.path && fs.existsSync(ord.screenshot.path)) {
            await client.sendMessage(ownerJid, { image: { url: ord.screenshot.path }, caption: ownerNotifyText });
          } else {
            notifyOwner(client, ownerNotifyText).catch(e => console.error('notifyOwner failed:', e));
          }
        } catch (e) {
          console.error('Failed to notify owner with screenshot:', e);
          notifyOwner(client, ownerNotifyText).catch(err => console.error('notifyOwner failed:', err));
        }
      })();

      await client.sendMessage(remoteJid, { text: `Tumepokea screenshot yako. Tutathibitisha malipo hivi karibuni. Oda ID: ${ord.id}` }, { quoted: message });
      return;
    }
  } catch (err) {
    console.error('orderCommand error:', err);
    try { await client.sendMessage(message.key.remoteJid, { text: 'Kuna hitilafu ndani ya mfumo wa oda. Tafadhali jaribu tena baadaye.' }); } catch (e) {}
  }
}
