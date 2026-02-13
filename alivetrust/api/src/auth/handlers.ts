import type { Env, SessionData } from '../types/index';
import { createSession, destroySession } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';

// ─── Hex Conversion Helpers ───

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ─── Password Hashing ───

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(salt) + ':' + toHex(new Uint8Array(hash));
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(hash)) === hashHex;
}

// ─── Email Validation ───

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Handlers ───

export async function register(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<{ email: string; password: string; name: string }>();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return errorResponse('Email, password, and name are required');
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format');
    }

    // Validate password length
    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    )
      .bind(email.toLowerCase())
      .first();

    if (existing) {
      return errorResponse('A user with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, email.toLowerCase(), name, passwordHash, now, now)
      .run();

    // Create session — createSession(env, user: User) uses user.id and user.email
    const token = await createSession(env, {
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      created_at: now,
      updated_at: now,
      last_login: null,
      status: 'active' as const,
    });

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: '',
      user_id: userId,
      action: 'create',
      entity_type: 'user',
      entity_id: userId,
      details: JSON.stringify({ email: email.toLowerCase(), name }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(
      {
        user: { id: userId, email: email.toLowerCase(), name },
        token,
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return errorResponse(message, 500);
  }
}

export async function login(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<{ email: string; password: string }>();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    // Look up user by email
    const user = await env.DB.prepare(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?'
    )
      .bind(email.toLowerCase())
      .first<{ id: string; email: string; name: string; password_hash: string }>();

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Create session — createSession(env, user: User) uses user.id and user.email
    const now = new Date().toISOString();
    const token = await createSession(env, {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      name: user.name,
      created_at: '',
      updated_at: '',
      last_login: null,
      status: 'active' as const,
    });

    // Update last_login
    await env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    )
      .bind(now, user.id)
      .run();

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: '',
      user_id: user.id,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      details: JSON.stringify({ email: user.email }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return errorResponse(message, 500);
  }
}

export async function logout(
  request: Request,
  env: Env,
  _params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';

    // Destroy session from KV
    await destroySession(env, token);

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: '',
      user_id: session.user_id,
      action: 'logout',
      entity_type: 'user',
      entity_id: session.user_id,
      details: null,
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse({ message: 'Logged out successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Logout failed';
    return errorResponse(message, 500);
  }
}
