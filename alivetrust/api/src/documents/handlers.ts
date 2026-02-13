import type { Env, SessionData, Document as TrustDocument } from '../types/index';
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
      doc_type: string;
      title: string;
      status?: string;
      file_url?: string;
      file_hash?: string;
      page_count?: number;
      date_signed?: string;
      date_notarized?: string;
      expiration_date?: string;
      required?: number;
      weight?: number;
      linked_asset_id?: string;
      notes?: string;
    }>();

    const {
      doc_type,
      title,
      status,
      file_url,
      file_hash,
      page_count,
      date_signed,
      date_notarized,
      expiration_date,
      required,
      weight,
      linked_asset_id,
      notes,
    } = body;

    if (!doc_type || !title) {
      return errorResponse('doc_type and title are required');
    }

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO document (
        id, trust_id, title, doc_type, status, file_url, file_hash,
        page_count, date_signed, date_notarized, expiration_date,
        required, weight, linked_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        docId,
        trustId,
        title,
        doc_type,
        status ?? 'draft',
        file_url ?? null,
        file_hash ?? null,
        page_count ?? null,
        date_signed ?? null,
        date_notarized ?? null,
        expiration_date ?? null,
        required ?? 0,
        weight ?? 1.0,
        linked_asset_id ?? null,
        notes ?? null,
        now,
        now
      )
      .run();

    const document: Partial<TrustDocument> = {
      id: docId,
      trust_id: trustId,
      title,
      doc_type,
      status: status ?? 'draft',
      notes: notes ?? undefined,
      created_at: now,
      updated_at: now,
    };

    // Log audit — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'create',
      entity_type: 'document',
      entity_id: docId,
      details: JSON.stringify({ doc_type, title }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(document, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create document';
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

    const { results } = await env.DB.prepare(
      `SELECT id, trust_id, title, doc_type, status, file_url, file_hash,
              page_count, date_signed, date_notarized, expiration_date,
              required, weight, linked_asset_id, notes, created_at, updated_at
       FROM document
       WHERE trust_id = ?
       ORDER BY created_at DESC`
    )
      .bind(trustId)
      .all<TrustDocument>();

    return jsonResponse(results ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list documents';
    return errorResponse(message, 500);
  }
}

export async function update(
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
): Promise<Response> {
  try {
    const trustId = params.trust_id;
    const docId = params.doc_id;

    if (!trustId || !docId) {
      return errorResponse('trust_id and doc_id are required');
    }

    // Verify tenant access
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    // Capture before state for audit
    const before = await env.DB.prepare(
      `SELECT id, trust_id, title, doc_type, status, file_url, file_hash,
              page_count, date_signed, date_notarized, expiration_date,
              required, weight, linked_asset_id, notes, created_at, updated_at
       FROM document
       WHERE id = ? AND trust_id = ?`
    )
      .bind(docId, trustId)
      .first<TrustDocument>();

    if (!before) {
      return errorResponse('Document not found', 404);
    }

    const body = await request.json<{
      doc_type?: string;
      title?: string;
      status?: string;
      file_url?: string;
      file_hash?: string;
      page_count?: number;
      date_signed?: string;
      date_notarized?: string;
      expiration_date?: string;
      required?: number;
      weight?: number;
      linked_asset_id?: string;
      notes?: string;
    }>();

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE document SET
        doc_type = COALESCE(?, doc_type),
        title = COALESCE(?, title),
        status = COALESCE(?, status),
        file_url = COALESCE(?, file_url),
        file_hash = COALESCE(?, file_hash),
        page_count = COALESCE(?, page_count),
        date_signed = COALESCE(?, date_signed),
        date_notarized = COALESCE(?, date_notarized),
        expiration_date = COALESCE(?, expiration_date),
        notes = COALESCE(?, notes),
        updated_at = ?
       WHERE id = ? AND trust_id = ?`
    )
      .bind(
        body.doc_type ?? null,
        body.title ?? null,
        body.status ?? null,
        body.file_url ?? null,
        body.file_hash ?? null,
        body.page_count ?? null,
        body.date_signed ?? null,
        body.date_notarized ?? null,
        body.expiration_date ?? null,
        body.notes ?? null,
        now,
        docId,
        trustId
      )
      .run();

    // Fetch updated record
    const after = await env.DB.prepare(
      `SELECT id, trust_id, title, doc_type, status, file_url, file_hash,
              page_count, date_signed, date_notarized, expiration_date,
              required, weight, linked_asset_id, notes, created_at, updated_at
       FROM document
       WHERE id = ? AND trust_id = ?`
    )
      .bind(docId, trustId)
      .first<TrustDocument>();

    // Log audit with before/after — logAudit(db, entry) expects D1Database as first arg
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'update',
      entity_type: 'document',
      entity_id: docId,
      details: JSON.stringify({ before, after }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(after);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update document';
    return errorResponse(message, 500);
  }
}
