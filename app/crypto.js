// Teacher-only files are encrypted with AES-GCM. One key is derived from the department password
// (PBKDF2) when the teacher logs in, and reused for every file.

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(password, info) {
  if (!window.crypto || !crypto.subtle) throw new Error("secure");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64(info.salt), iterations: info.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  await decrypt(key, info.check); // throws if the password is wrong
  return key;
}

export async function decrypt(key, blob) {
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.data));
  return new TextDecoder().decode(buf);
}

export async function decryptJson(key, blob) {
  return JSON.parse(await decrypt(key, blob));
}
