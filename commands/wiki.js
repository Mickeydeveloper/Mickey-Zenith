import fetch from "node-fetch";

async function searchWikipedia(query, lang = "en") {

    try {

        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

        const res = await fetch(url);

        if (!res.ok) throw new Error("No result found.");

        const data = await res.json();

        if (data.extract) {
            return `*${data.title}*\n\n${data.extract}\n\n🔗 ${data.content_urls.desktop.page}`;
        } else {
            return `Sorry, the topic "${query}" was not found on ${lang}.wikipedia.org`;
        }
    } catch (error) {
        return `Error: ${error.message}`;
    }
}


export  async function wikien(message, client) {
    const remoteJid = message.key?.remoteJid;

    if (!remoteJid) {
        throw new Error("Message JID is undefined.");
    }

    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    const parts = messageBody.trim().split(/\s+/);
    const args = parts.slice(1); // Remove the ".wiki" command itself

    if (args.length === 0) {
        await client.sendMessage(remoteJid, {
            text: "> _No topic was specified. Please follow this example: .wiki thermodynamic_"
        });
    } else {
        const query = args.join(" ");
        await client.sendMessage(remoteJid, {
            text: `> _Making some research on Wikipedia for "${query}"..._`
        });

        const research = await searchWikipedia(query, "en");
        await client.sendMessage(remoteJid, { text: research });
    }
}


export  async function wikifr(message, client) {
    const remoteJid = message.key?.remoteJid;

    if (!remoteJid) {
        throw new Error("Message JID is undefined.");
    }

    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    const parts = messageBody.trim().split(/\s+/);
    const args = parts.slice(1); // Remove the ".wiki" command itself

    if (args.length === 0) {
        await client.sendMessage(remoteJid, {
            text: "> _No topic was specified. Please follow this example: .wiki thermodynamic_"
        });
    } else {
        const query = args.join(" ");
        await client.sendMessage(remoteJid, {
            text: `> _Making some research on Wikipedia for "${query}"..._`
        });

        const research = await searchWikipedia(query, "fr");
        await client.sendMessage(remoteJid, { text: research });
    }
}

export default {wikien, wikifr}
