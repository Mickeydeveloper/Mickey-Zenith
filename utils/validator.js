import { OWNER_ID } from "../config.js";

export default function isValidCode(code) {

  try {

    const decoded = Buffer.from(code, "base64").toString(); // "userId|expiry"

    const [id, expiry] = decoded.split("|");

    const idNum = id;

    const expiryNum = Number(expiry);

    if (OWNER_ID !== idNum) return false;         // check user

    if (Date.now() > expiryNum) return false;     // check expiry

    return true;               // remaining ms

  } catch (e) {

    console.log("Error decoding key:", e);

    return false;
  }
}
