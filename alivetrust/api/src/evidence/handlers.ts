import type { Env, SessionData, Evidence } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';

// ─── Handlers ───

export async function create(
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

    const body = await request.json<{
      evidence_type: string;
      title: string;
      description?: string;
      file_key?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      linked_asset_id?: string;
      linked_doc_id?: string;
      notes?: string;
    }>();

    const {
      evidence_type,
      title,
      description,
      file_key,
      file_name,
      file_size,
      mime_type,
      linked_asset_id,
      linked_doc_id,
      notes,
    } = body;

    if (!evidence_type || !title) {
      return errorResponse('evidence_type and title are required');
    }

    // Validate linked_asset_id exists if provided
    if (linked_asset_id) {
      const asset = await env.DB.prepare(
        'SELECT id FROM asset WHERE id = ? AND trust_id = ?'
      )
        .bind(linked_asset_id, trustId)
        .first();

      if (!asset) {
        return errorResponse('Linked asset not found in this trust', 404);
      }
    }

    // Validate linked_doc_id exists if provided
    if (linked_doc_id) {
      const doc = await env.DB.prepare(
        'SELECT id FROM document WHERE id = ? AND trust_id = ?'
      )
        .bind(linked_doc_id, trustId)
        .first();

      if (!doc) {
        return errorResponse('Linked document not found in this trust', 404);
      }
    }

    const evidenceId = crypto.randomUUID();
    const now = new Date().toISOString();

    // file_key is a placeholder for R2 storage — actual upload handled separately
    await env.DB.prepare(
      `INSERT INTO evidence (
        id, trust_id, evidence_type, title, description, file_key,
        file_name, file_size, mime_type, linked_asset_id, linked_doc_id,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        evidenceId,
        trustId,
        evidence_type,
        title,
        description ?? null,
        file_key ?? null,
        file_name ?? null,
        file_size ?? null,
        mime_type ?? null,
        linked_asset_id ?? null,
        linked_doc_id ?? null,
        notes ?? null,
        now,
        now
      )
      .run();

    const evidence: Partial<Evidence> = {
      id: evidenceId,
      trust_id: trustId,
      evidence_type,
      title,
      description: description ?? undefined,
      file_key: file_key ?? undefined,
      file_name: file_name ?? undefined,
      file_size: file_size ?? undefined,
      mime_type: mime_type ?? undefined,
      linked_asset_id: linked_asset_id ?? undefined,
      linked_doc_id: linked_doc_id ?? undefined,
      notes: notes ?? undefined,
      created_at: now,
      updated_at: now,
    };

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'create',
      entity_type: 'evidence',
      entity_id: evidenceId,
      details: JSON.stringify({
        evidence_type,
        title,
        linked_asset_id: linked_asset_id ?? null,
        linked_doc_id: linked_doc_id ?? null,
      }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(evidence, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create evidence';
    return errorResponse(message, 500);
  }
}

export async function list(
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

    // Check for optional query param filters
    const url = new URL(request.url);
    const linkedAssetId = url.searchParams.get('linked_asset_id');
    const linkedDocId = url.searchParams.get('linked_doc_id');

    let query: string;
    const bindings: (string | null)[] = [trustId];

    if (linkedAssetId && linkedDocId) {
      query = `SELECT id, trust_id, evidence_type, title, description, file_key,
                      file_name, file_size, mime_type, linked_asset_id, linked_doc_id,
                      notes, created_at, updated_at
               FROM evidence
               WHERE trust_id = ? AND linked_asset_id = ? AND linked_doc_id = ?
               ORDER BY created_at DESC`;
      bindings.push(linkedAssetId, linkedDocId);
    } else if (linkedAssetId) {
      query = `SELECT id, trust_id, evidence_type, title, description, file_key,
                      file_name, file_size, mime_type, linked_asset_id, linked_doc_id,
                      notes, created_at, updated_at
               FROM evidence
               WHERE trust_id = ? AND linked_asset_id = ?
               ORDER BY created_at DESC`;
      bindings.push(linkedAssetId);
    } else if (linkedDocId) {
      query = `SELECT id, trust_id, evidence_type, title, description, file_key,
                      file_name, file_size, mime_type, linked_asset_id, linked_doc_id,
                      notes, created_at, updated_at
               FROM evidence
               WHERE trust_id = ? AND linked_doc_id = ?
               ORDER BY created_at DESC`;
      bindings.push(linkedDocId);
    } else {
      query = `SELECT id, trust_id, evidence_type, title, description, file_key,
                      file_name, file_size, mime_type, linked_asset_id, linked_doc_id,
                      notes, created_at, updated_at
               FROM evidence
               WHERE trust_id = ?
               ORDER BY created_at DESC`;
    }

    const stmt = env.DB.prepare(query);
    const bound =
      bindings.length === 1
        ? stmt.bind(bindings[0])
        : bindings.length === 2
          ? stmt.bind(bindings[0], bindings[1])
          : stmt.bind(bindings[0], bindings[1], bindings[2]);

    const { results } = await bound.all<Evidence>();

    return jsonResponse(results ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list evidence';
    return errorResponse(message, 500);
  }
}
