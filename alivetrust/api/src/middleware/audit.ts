import type { AuditLogEntry } from '../types/index.js';

/**
 * Audit logging middleware.
 *
 * Records all significant actions against trust profiles for compliance,
 * debugging, and user transparency. Every mutation (create, update, delete)
 * and sensitive read should be logged.
 */

/**
 * Log an audit entry to the audit_log table.
 *
 * Accepts all fields except `id` and `created_at`, which are generated
 * automatically.
 */
export async function logAudit(
  db: D1Database,
  entry: Omit<AuditLogEntry, 'id' | 'created_at'>
): Promise<void> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO audit_log (id, trust_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      entry.trust_id,
      entry.user_id,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.details,
      entry.ip_address
    )
    .run();
}

/**
 * Retrieve recent audit log entries for a specific trust profile.
 *
 * Results are ordered by created_at descending (most recent first).
 * Default limit is 50 entries.
 */
export async function getAuditLog(
  db: D1Database,
  trustId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const result = await db
    .prepare(
      `SELECT id, trust_id, user_id, action, entity_type, entity_id, details, ip_address, created_at
       FROM audit_log
       WHERE trust_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(trustId, limit)
    .all<AuditLogEntry>();

  return result.results;
}

/**
 * Extract the client IP address from the request.
 *
 * Cloudflare Workers provide the connecting IP via the CF-Connecting-IP header.
 * Falls back to X-Forwarded-For or null if neither is present.
 */
export function getClientIp(request: Request): string | null {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For') ??
    null
  );
}
