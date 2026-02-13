import type { Env, SessionData, User } from '../types/index.js';

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Authenticate a request by reading the Authorization: Bearer <token> header
 * and looking up the session in KV.
 *
 * Returns the SessionData if valid, or null if missing/expired/invalid.
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<SessionData | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];
  if (!token) {
    return null;
  }

  try {
    const stored = await env.SESSIONS.get(token, 'json');
    if (!stored) {
      return null;
    }

    const session = stored as SessionData;

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await env.SESSIONS.delete(token);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Require authentication. Throws a 401 Response if the request is not
 * authenticated.
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<SessionData> {
  const session = await authenticateRequest(request, env);
  if (!session) {
    throw new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication required. Provide a valid Bearer token.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  return session;
}

/**
 * Create a new session for a user. Generates a cryptographically random token,
 * stores the session data in KV with a 24-hour TTL, and returns the token.
 */
export async function createSession(
  env: Env,
  user: User
): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  const sessionData: SessionData = {
    user_id: user.id,
    email: user.email,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  await env.SESSIONS.put(token, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return token;
}

/**
 * Destroy a session by deleting the token from KV.
 */
export async function destroySession(
  env: Env,
  token: string
): Promise<void> {
  await env.SESSIONS.delete(token);
}

/**
 * Extract the raw bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] ?? null;
}
