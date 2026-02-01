import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

export async function handleVerify(path, method, request, env) {
  if (path === '/email' && method === 'POST') return verifyEmail(request, env);
  if (path === '/email/resend' && method === 'POST') return resendEmail(request, env);
  if (path === '/phone/send' && method === 'POST') return sendPhoneCode(request, env);
  if (path === '/phone' && method === 'POST') return verifyPhone(request, env);
  if (path === '/tier' && method === 'GET') return getTier(request, env);
  return error('Verify route not found', 404);
}

async function verifyEmail(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { code } = await request.json();
  if (!code) return error('Verification code required');

  const record = await env.DB.prepare(
    'SELECT * FROM v6_verification_codes WHERE user_id = ? AND type = ? AND code = ? AND used = 0 AND expires_at > datetime("now")'
  ).bind(auth.user.id, 'email', code.toUpperCase()).first();

  if (!record) return error('Invalid or expired code');

  await env.DB.batch([
    env.DB.prepare('UPDATE v6_verification_codes SET used = 1 WHERE id = ?').bind(record.id),
    env.DB.prepare('UPDATE v6_users SET email_verified = 1, verification_tier = MAX(verification_tier, 1), status = "active", updated_at = datetime("now") WHERE id = ?').bind(auth.user.id)
  ]);

  return success({ verification_tier: 1 }, 'Email verified');
}

async function resendEmail(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  if (auth.user.email_verified) return error('Email already verified');

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expires = new Date(Date.now() + 3600000).toISOString();

  await env.DB.prepare('UPDATE v6_verification_codes SET used = 1 WHERE user_id = ? AND type = ?').bind(auth.user.id, 'email').run();
  await env.DB.prepare('INSERT INTO v6_verification_codes (user_id, type, code, expires_at) VALUES (?, ?, ?, ?)').bind(auth.user.id, 'email', code, expires).run();

  console.log(`[DEV] Resent email code for user ${auth.user.id}: ${code}`);
  return success({ verification_code_dev: code }, 'Verification code sent');
}

async function sendPhoneCode(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { phone } = await request.json();
  if (!phone) return error('Phone number required');

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 600000).toISOString();

  await env.DB.prepare('UPDATE v6_users SET phone = ?, updated_at = datetime("now") WHERE id = ?').bind(phone, auth.user.id).run();
  await env.DB.prepare('INSERT INTO v6_verification_codes (user_id, type, code, expires_at) VALUES (?, ?, ?, ?)').bind(auth.user.id, 'phone', code, expires).run();

  console.log(`[DEV] Phone code for ${phone}: ${code}`);

  // Twilio stub
  if (env.TWILIO_SID && env.TWILIO_AUTH) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`;
      await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${env.TWILIO_SID}:${env.TWILIO_AUTH}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_PHONE, Body: `Novai verification code: ${code}` })
      });
    } catch (e) {
      console.log('Twilio send failed:', e.message);
    }
  }

  return success({ verification_code_dev: code }, 'Phone code sent');
}

async function verifyPhone(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { code } = await request.json();
  if (!code) return error('Code required');

  const record = await env.DB.prepare(
    'SELECT * FROM v6_verification_codes WHERE user_id = ? AND type = ? AND code = ? AND used = 0 AND expires_at > datetime("now")'
  ).bind(auth.user.id, 'phone', code).first();

  if (!record) return error('Invalid or expired code');

  await env.DB.batch([
    env.DB.prepare('UPDATE v6_verification_codes SET used = 1 WHERE id = ?').bind(record.id),
    env.DB.prepare('UPDATE v6_users SET phone_verified = 1, verification_tier = MAX(verification_tier, 2), updated_at = datetime("now") WHERE id = ?').bind(auth.user.id)
  ]);

  return success({ verification_tier: 2 }, 'Phone verified');
}

async function getTier(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  // Tier 0: Registered, Tier 1: Email verified, Tier 2: Phone verified, Tier 3: Admin-approved
  return success({
    tier: auth.user.verification_tier,
    email_verified: !!auth.user.email_verified,
    phone_verified: !!auth.user.phone_verified,
    tiers: {
      0: 'Registered - basic access',
      1: 'Email verified - can create jobs',
      2: 'Phone verified - can become provider',
      3: 'Fully verified - priority matching'
    }
  });
}
