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
      document_type: string;
      title: string;
      description?: string;
      file_key?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      status?: string;
      notes?: string;
    }>();

    const {
      document_type,
      title,
      description,
      file_key,
      file_name,
      file_size,
      mime_type,
      status,
      notes,
    } = body;

    if (!document_type || !title) {
      return errorResponse('document_type and title are required');
    }

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO documents (
        id, trust_id, document_type, title, description, file_key,
        file_name, file_size, mime_type, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        docId,
        trustId,
        document_type,
        title,
        description ?? null,
        file_key ?? null,
        file_name ?? null,
        file_size ?? null,
        mime_type ?? null,
        status ?? 'draft',
        notes ?? null,
        now,
        now
      )
      .run();

    const document: Partial<TrustDocument> = {
      id: docId,
      trust_id: trustId,
      document_type,
      title,
      description: description ?? undefined,
      file_key: file_key ?? undefined,
      file_name: file_name ?? undefined,
      file_size: file_size ?? undefined,
      mime_type: mime_type ?? undefined,
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
      details: JSON.stringify({ document_type, title }),
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
      `SELECT id, trust_id, document_type, title, description, file_key,
              file_name, file_size, mime_type, status, notes, created_at, updated_at
       FROM documents
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
      `SELECT id, trust_id, document_type, title, description, file_key,
              file_name, file_size, mime_type, status, notes, created_at, updated_at
       FROM documents
       WHERE id = ? AND trust_id = ?`
    )
      .bind(docId, trustId)
      .first<TrustDocument>();

    if (!before) {
      return errorResponse('Document not found', 404);
    }

    const body = await request.json<{
      document_type?: string;
      title?: string;
      description?: string;
      file_key?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      status?: string;
      notes?: string;
    }>();

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE documents SET
        document_type = COALESCE(?, document_type),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        file_key = COALESCE(?, file_key),
        file_name = COALESCE(?, file_name),
        file_size = COALESCE(?, file_size),
        mime_type = COALESCE(?, mime_type),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = ?
       WHERE id = ? AND trust_id = ?`
    )
      .bind(
        body.document_type ?? null,
        body.title ?? null,
        body.description ?? null,
        body.file_key ?? null,
        body.file_name ?? null,
        body.file_size ?? null,
        body.mime_type ?? null,
        body.status ?? null,
        body.notes ?? null,
        now,
        docId,
        trustId
      )
      .run();

    // Fetch updated record
    const after = await env.DB.prepare(
      `SELECT id, trust_id, document_type, title, description, file_key,
              file_name, file_size, mime_type, status, notes, created_at, updated_at
       FROM documents
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
