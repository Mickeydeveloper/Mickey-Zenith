
const api = "https://raw.githubusercontent.com/Mickeydeveloper/Mickey-Zenith/refs/heads/main/credits.json";

let credsCache = null;

export async function getCreds() {

  if (credsCache) return credsCache; // use cache if already fetched

  try {

    const res = await fetch(api);

    if (!res.ok) throw new Error("Failed");
    
    const data = await res.json();

    credsCache = data; // save to cache

    return data;

  } catch (err) {

    console.error("Error fetching:", err.message);

    return null;

  }
}
