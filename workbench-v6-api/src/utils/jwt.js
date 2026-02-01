// JWT implementation using Web Crypto API

async function createToken(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };

  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const bodyB64 = btoa(JSON.stringify(body)).replace(/=/g, '');
  const message = `${headerB64}.${bodyB64}`;

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${sigB64}`;
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, bodyB64, sigB64] = parts;
    const message = `${headerB64}.${bodyB64}`;
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sig = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sig[i] = sigStr.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(message));
    if (!valid) return null;

    const payload = JSON.parse(atob(bodyB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export { createToken, verifyToken };
