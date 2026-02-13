import type { Env, SessionData, TrustProfile } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';

// ─── Handlers ───

export async function create(
  request: Request,
  env: Env,
  _params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const body = await request.json<{
      trust_name: string;
      trust_type: string;
      date_established: string;
      jurisdiction: string;
      grantor_names: string[];
      trustee_names: string[];
      successor_trustee_names: string[];
      beneficiary_names: string[];
      ein?: string;
      notes?: string;
    }>();

    const {
      trust_name,
      trust_type,
      date_established,
      jurisdiction,
      grantor_names,
      trustee_names,
      successor_trustee_names,
      beneficiary_names,
      ein,
      notes,
    } = body;

    // Validate required fields
    if (!trust_name || !trust_type || !date_established || !jurisdiction) {
      return errorResponse(
        'trust_name, trust_type, date_established, and jurisdiction are required'
      );
    }

    if (!grantor_names?.length || !trustee_names?.length || !beneficiary_names?.length) {
      return errorResponse(
        'At least one grantor, trustee, and beneficiary are required'
      );
    }

    const trustId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO trust_profile (
        id, user_id, trust_name, trust_type, date_established, jurisdiction,
        grantor_names, trustee_names, successor_trustee_names, beneficiary_names,
        ein, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        trustId,
        session.user_id,
        trust_name,
        trust_type,
        date_established,
        jurisdiction,
        JSON.stringify(grantor_names),
        JSON.stringify(trustee_names),
        JSON.stringify(successor_trustee_names ?? []),
        JSON.stringify(beneficiary_names),
        ein ?? null,
        notes ?? null,
        now,
        now
      )
      .run();

    const trustProfile: Partial<TrustProfile> = {
      id: trustId,
      trust_name,
      trust_type,
      date_established,
      jurisdiction,
      grantor_names,
      trustee_names,
      successor_trustee_names: successor_trustee_names ?? [],
      beneficiary_names,
      ein: ein ?? undefined,
      notes: notes ?? undefined,
      created_at: now,
      updated_at: now,
    };

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'create',
      entity_type: 'trust_profile',
      entity_id: trustId,
      details: JSON.stringify({ trust_name, trust_type }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(trustProfile, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create trust profile';
    return errorResponse(message, 500);
  }
}

export async function get(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;

    if (!trustId) {
      return errorResponse('trust_id is required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const row = await env.DB.prepare(
      `SELECT id, user_id, trust_name, trust_type, date_established, jurisdiction,
              grantor_names, trustee_names, successor_trustee_names, beneficiary_names,
              ein, notes, created_at, updated_at
       FROM trust_profile
       WHERE id = ?`
    )
      .bind(trustId)
      .first<{
        id: string;
        user_id: string;
        trust_name: string;
        trust_type: string;
        date_established: string;
        jurisdiction: string;
        grantor_names: string;
        trustee_names: string;
        successor_trustee_names: string;
        beneficiary_names: string;
        ein: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!row) {
      return errorResponse('Trust profile not found', 404);
    }

    // Parse JSON array fields back to arrays
    const trustProfile = {
      ...row,
      grantor_names: JSON.parse(row.grantor_names) as string[],
      trustee_names: JSON.parse(row.trustee_names) as string[],
      successor_trustee_names: JSON.parse(row.successor_trustee_names) as string[],
      beneficiary_names: JSON.parse(row.beneficiary_names) as string[],
      ein: row.ein ?? undefined,
      notes: row.notes ?? undefined,
    };

    return jsonResponse(trustProfile);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve trust profile';
    return errorResponse(message, 500);
  }
}
