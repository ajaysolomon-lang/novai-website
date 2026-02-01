// Password hashing using Web Crypto API (Cloudflare Workers compatible)

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const exported = await crypto.subtle.exportKey('raw', key);
  const hashArray = new Uint8Array(exported);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await deriveKey(password, salt);
  const exported = await crypto.subtle.exportKey('raw', key);
  const newHash = Array.from(new Uint8Array(exported)).map(b => b.toString(16).padStart(2, '0')).join('');
  return newHash === hashHex;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
}

export { hashPassword, verifyPassword };
