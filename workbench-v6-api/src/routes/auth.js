import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { createToken } from '../utils/jwt.js';
import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

export async function handleAuth(path, method, request, env) {
  if (path === '/register' && method === 'POST') return register(request, env);
  if (path === '/login' && method === 'POST') return login(request, env);
  if (path === '/me' && method === 'GET') return getMe(request, env);
  return error('Auth route not found', 404);
}

async function register(request, env) {
  try {
    const { email, password, name, phone } = await request.json();

    if (!email || !password || !name) {
      return error('Email, password, and name are required');
    }
    if (password.length < 8) {
      return error('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return error('Password must contain uppercase letter and number');
    }

    const existing = await env.DB.prepare('SELECT id FROM v6_users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) {
      return error('Email already registered');
    }

    const password_hash = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO v6_users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)'
    ).bind(email.toLowerCase(), password_hash, name, phone || null).run();

    const userId = result.meta.last_row_id;

    // Generate email verification code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires = new Date(Date.now() + 3600000).toISOString();
    await env.DB.prepare(
      'INSERT INTO v6_verification_codes (user_id, type, code, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, 'email', code, expires).run();

    // SendGrid stub - log code for dev
    console.log(`[DEV] Email verification code for ${email}: ${code}`);

    if (env.SENDGRID_API_KEY) {
      try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: 'noreply@novaisystems.online', name: 'Novai Workbench' },
            subject: 'Verify your email',
            content: [{ type: 'text/plain', value: `Your verification code: ${code}` }]
          })
        });
      } catch (e) {
        console.log('SendGrid send failed:', e.message);
      }
    }

    const token = await createToken({ sub: userId, email: email.toLowerCase(), role: 'user' }, env.JWT_SECRET);

    return success({ token, user: { id: userId, email, name, role: 'user' }, verification_code_dev: code }, 'Registration successful');
  } catch (e) {
    return error('Registration failed: ' + e.message, 500);
  }
}

async function login(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return error('Email and password required');

    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, role, status, email_verified, phone_verified, verification_tier FROM v6_users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) return error('Invalid credentials', 401);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return error('Invalid credentials', 401);

    const token = await createToken({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

    return success({
      token,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        status: user.status, email_verified: user.email_verified,
        phone_verified: user.phone_verified, verification_tier: user.verification_tier
      }
    }, 'Login successful');
  } catch (e) {
    return error('Login failed: ' + e.message, 500);
  }
}

async function getMe(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  return success({ user: auth.user });
}
