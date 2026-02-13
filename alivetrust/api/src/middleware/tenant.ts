/**
 * Tenant isolation middleware.
 *
 * Ensures that a user can only access trust profiles that belong to them.
 * Every data-bearing route that references a :trust_id must pass through
 * this check before returning any data.
 */

/**
 * Verify that the given user owns (or has access to) the specified trust profile.
 *
 * Returns true if the trust exists and belongs to the user, false otherwise.
 */
export async function verifyTenantAccess(
  db: D1Database,
  trustId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM trust_profile WHERE id = ? AND user_id = ?')
    .bind(trustId, userId)
    .first<{ id: string }>();

  return result !== null;
}

/**
 * Require tenant access. Throws a 403 Response if the user does not own
 * the specified trust profile.
 */
export async function requireTenantAccess(
  db: D1Database,
  trustId: string,
  userId: string
): Promise<void> {
  const hasAccess = await verifyTenantAccess(db, trustId, userId);

  if (!hasAccess) {
    throw new Response(
      JSON.stringify({
        success: false,
        error: 'Access denied. You do not have permission to access this trust profile.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
