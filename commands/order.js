import { BOT_NAME } from '../config.js';

/**
 * Sends bundle prices and payment details with improved formatting.
 * Includes a 20-second delay before sending payment information.
 */
export async function order(message, client) {
	try {
		const remoteJid = message?.key?.remoteJid;
		const firstName = message?.pushName || 'Customer';

		if (!remoteJid) {
			console.error('❌ Cannot determine chat ID for order command');
			return;
		}

		// Bundle rate logic
		const rateGB10 = 10; // Price for 10GB
		const pricePerGB = rateGB10 / 10; // Price per GB

		const bundles = [10, 20, 30, 40, 50];
		const bundleLines = bundles.map(gb => `✅ *${gb} GB* — *${gb * pricePerGB} TSHS*`);

		// First message: bundle prices
		const bundlesMessage =
			`╭━━━〔 *${BOT_NAME || 'BOT'} – DATA BUNDLES* 〕━━━╮\n` +
			`👋 Hello *${firstName}*, here are our latest bundle prices:\n\n` +
			bundleLines.join('\n') +
			`\n\n💰 *Rate:* _10GB = ${rateGB10} TSHS_ (➡️ _1GB = ${pricePerGB} TSHS_)\n\n` +
			`🛒 *To order:* send\n➡️  _Order <size>GB_\n` +
			`Example:  *Order 10GB*\n` +
			`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

		// Payment message (sent after delay)
		const paymentsMessage =
			`╭━━━〔 *PAYMENT METHODS* 】━━━╮\n` +
			`💳 You can pay using any of the methods below:\n\n` +
			`• 🟣 *Tigo Pesa:*  071176535\n` +
			`• 🟢 *Halopesa 1:*  0615944741\n` +
			`• 🔵 *Halotel / Others:* 0612130873\n` +
			`• 🏦 *Bank Transfer:* NMB — 24810015538\n\n` +
			`📤 After payment send:\n` +
			`• Phone number\n` +
			`• Bundle size (e.g., *10GB*)\n` +
			`• Delivery method (SMS / Auto)\n\n` +
			`⏱️ Admin will confirm & deliver shortly.\n` +
			`╰━━━━━━━━━━━━━━━━━━━━━╯`;

		// --- Sending messages ---
		await client.sendMessage(remoteJid, { text: bundlesMessage });

		// Delay 20 seconds before sending the next message
		await new Promise(resolve => setTimeout(resolve, 20000));

		await client.sendMessage(remoteJid, { text: paymentsMessage });

	} catch (error) {
		console.error('❌ Error in order command:', error);
	}
}

export default order;
