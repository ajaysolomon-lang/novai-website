import type { Env, SessionData } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse, forbiddenResponse } from '../utils/response';
import { ingestDocument, queryChunks } from './engine';

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * POST /trusts/:trust_id/rag/ingest
 *
 * Ingest a document's text content into the RAG index for later retrieval.
 * Chunks the content and stores it in `doc_chunks` with tenant isolation.
 *
 * Body:
 *   - content: string (required) — the full text content to ingest
 *   - source_doc_id?: string — the document ID this content came from
 *   - source_evidence_id?: string — the evidence ID this content came from
 */
export async function ingest(
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

    // Verify tenant access.
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return forbiddenResponse();
    }

    const body = await request.json<{
      content: string;
      source_doc_id?: string;
      source_evidence_id?: string;
    }>();

    if (!body.content || body.content.trim().length === 0) {
      return errorResponse('content is required and must not be empty');
    }

    // Ingest the document content into chunks.
    const chunkIds = await ingestDocument(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      source_doc_id: body.source_doc_id,
      source_evidence_id: body.source_evidence_id,
      source_type: 'user_document',
      content: body.content,
    });

    // Log the ingestion for audit trail.
    // logAudit expects Omit<AuditLogEntry, 'id' | 'created_at'> with fields: trust_id, user_id, action, entity_type, entity_id, details, ip_address
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'create',
      entity_type: 'doc_chunk',
      entity_id: chunkIds[0] ?? '',
      details: JSON.stringify({
        chunk_count: chunkIds.length,
        source_doc_id: body.source_doc_id ?? null,
        source_evidence_id: body.source_evidence_id ?? null,
      }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse({ chunk_ids: chunkIds }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ingest document';
    return errorResponse(message, 500);
  }
}

/**
 * POST /trusts/:trust_id/rag/query
 *
 * Query the RAG index for chunks relevant to a natural-language question.
 * Returns matching chunks with citations, data-gap indicators, and the
 * mandatory legal disclaimer.
 *
 * IMPORTANT: This endpoint never returns legal determinations. It only
 * returns retrieved text chunks with citations. The disclaimer is always
 * included in the response.
 *
 * Body:
 *   - query: string (required) — the natural-language search query
 *   - source_type?: 'user_document' | 'verified_source' — filter by source
 *   - limit?: number — max chunks to return (default 10)
 */
export async function query(
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

    // Verify tenant access.
    const hasAccess = await verifyTenantAccess(env.DB, trustId, session.user_id);
    if (!hasAccess) {
      return forbiddenResponse();
    }

    const body = await request.json<{
      query: string;
      source_type?: 'user_document' | 'verified_source';
      limit?: number;
    }>();

    if (!body.query || body.query.trim().length === 0) {
      return errorResponse('query is required and must not be empty');
    }

    // Validate source_type if provided.
    if (body.source_type && !['user_document', 'verified_source'].includes(body.source_type)) {
      return errorResponse('source_type must be "user_document" or "verified_source"');
    }

    // Validate limit if provided.
    const limit = body.limit ?? 10;
    if (limit < 1 || limit > 50) {
      return errorResponse('limit must be between 1 and 50');
    }

    // Execute the RAG query.
    const result = await queryChunks(env.DB, {
      trust_id: trustId,
      query: body.query,
      source_type: body.source_type,
      limit,
    });

    // Return with citations and disclaimer. Never legal determinations.
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query RAG index';
    return errorResponse(message, 500);
  }
}
