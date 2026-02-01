import { verifyToken } from '../utils/jwt.js';
import { error } from '../utils/response.js';

export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: error('No token provided', 401) };
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return { user: null, error: error('Invalid or expired token', 401) };
  }

  const user = await env.DB.prepare('SELECT id, email, name, role, status, email_verified, phone_verified, verification_tier FROM v6_users WHERE id = ?').bind(payload.sub).first();
  if (!user) {
    return { user: null, error: error('User not found', 401) };
  }

  return { user, error: null };
}

export async function requireAuth(request, env) {
  return authenticate(request, env);
}

export async function requireAdmin(request, env) {
  const auth = await authenticate(request, env);
  if (auth.error) return auth;
  if (auth.user.role !== 'admin') {
    return { user: null, error: error('Admin access required', 403) };
  }
  return auth;
}
