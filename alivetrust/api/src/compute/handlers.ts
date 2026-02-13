/**
 * AliveTrust — Compute API Handler
 *
 * Loads all trust data from D1, calls the deterministic scoring engine,
 * stores the computation snapshot, logs an audit entry, and returns the
 * full ComputeResults to the client.
 *
 * Side effects (DB reads/writes, audit logging) live here — never in the
 * engine itself.
 */

import type { Env, SessionData, TrustProfile, ComputeResults } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit, getClientIp } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';
import {
  computeTrustHealth,
  type AssetRow,
  type DocumentRow,
  type EvidenceRow,
  type ComputeInput,
} from './engine';

// ─── Compute Handler ───────────────────────────────────────────────────────

export async function compute(
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

    // Load trust profile
    const trustRow = await env.DB.prepare(
      `SELECT id, user_id, name AS trust_name, type AS trust_type, state AS jurisdiction,
              county, date_created AS date_established, date_last_amended,
              grantor_names, trustee_names, successor_trustee_names, beneficiary_names,
              notes, created_at, updated_at
       FROM trust_profile
       WHERE id = ?`
    )
      .bind(trustId)
      .first<{
        id: string;
        user_id: string;
        trust_name: string;
        trust_type: string;
        jurisdiction: string;
        county: string | null;
        date_established: string | null;
        date_last_amended: string | null;
        grantor_names: string | null;
        trustee_names: string | null;
        successor_trustee_names: string | null;
        beneficiary_names: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!trustRow) {
      return errorResponse('Trust profile not found', 404);
    }

    // Parse JSON array fields
    const trust: TrustProfile = {
      ...trustRow,
      trust_type: trustRow.trust_type as TrustProfile['trust_type'],
      grantor_names: safeParseArray(trustRow.grantor_names),
      trustee_names: safeParseArray(trustRow.trustee_names),
      successor_trustee_names: safeParseArray(trustRow.successor_trustee_names),
      beneficiary_names: safeParseArray(trustRow.beneficiary_names),
      // Fields that exist on TrustProfile but are derived / not stored directly
      estimated_estate_value: null,
      has_pour_over_will: false,   // Will be inferred from documents
      has_power_of_attorney: false,
      has_healthcare_directive: false,
      status: 'active' as const,
    };

    // Load all assets for this trust
    const assetsResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, name, type, subtype, estimated_value,
              funding_status, funding_method, beneficiary_designation, intended_beneficiary,
              location_address, account_number_last4, institution, notes, created_at, updated_at
       FROM assets
       WHERE trust_id = ?`
    )
      .bind(trustId)
      .all<AssetRow>();

    const assets: AssetRow[] = assetsResult.results;

    // Load all documents for this trust
    const documentsResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, name, doc_type, status, date_signed,
              date_expires, required, weight, linked_asset_id, notes, created_at, updated_at
       FROM documents
       WHERE trust_id = ?`
    )
      .bind(trustId)
      .all<DocumentRow>();

    const documents: DocumentRow[] = documentsResult.results;

    // Load all evidence for this trust
    const evidenceResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, linked_asset_id, linked_doc_id, type,
              file_name, file_key, mime_type, file_size, uploaded_at,
              verified, verified_by, verified_at, notes
       FROM evidence
       WHERE trust_id = ?`
    )
      .bind(trustId)
      .all<EvidenceRow>();

    const evidence: EvidenceRow[] = evidenceResult.results;

    // Build compute input
    const computeInput: ComputeInput = { trust, assets, documents, evidence };

    // Hash the inputs for cache-check / deduplication
    const inputHash = await hashInput(computeInput);

    // Check if we already have a computation with this exact input hash
    const existingComputation = await env.DB.prepare(
      `SELECT id, results FROM computations
       WHERE trust_id = ? AND input_hash = ?
       ORDER BY computed_at DESC
       LIMIT 1`
    )
      .bind(trustId, inputHash)
      .first<{ id: string; results: string }>();

    if (existingComputation) {
      // Return cached results — data hasn't changed
      const cachedResults: ComputeResults = JSON.parse(existingComputation.results);
      return jsonResponse({
        computation_id: existingComputation.id,
        cached: true,
        results: cachedResults,
      });
    }

    // Run the deterministic scoring engine
    const results: ComputeResults = computeTrustHealth(computeInput);

    // Store computation snapshot
    const computationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Determine the latest version number
    const versionRow = await env.DB.prepare(
      `SELECT MAX(version) AS max_version FROM computations WHERE trust_id = ?`
    )
      .bind(trustId)
      .first<{ max_version: number | null }>();

    const nextVersion = (versionRow?.max_version ?? 0) + 1;

    // Determine trigger source
    const trigger = getTriggerSource(request);

    await env.DB.prepare(
      `INSERT INTO computations (id, trust_id, user_id, computed_at, version, input_hash, results, trigger)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        computationId,
        trustId,
        session.user_id,
        now,
        nextVersion,
        inputHash,
        JSON.stringify(results),
        trigger
      )
      .run();

    // Log audit entry
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'compute',
      entity_type: 'computation',
      entity_id: computationId,
      details: JSON.stringify({
        version: nextVersion,
        funding_coverage_value_pct: results.funding_coverage_value_pct,
        probate_exposure_amount: results.probate_exposure_amount,
        red_flag_count: results.red_flags.length,
        data_gap_count: results.data_gaps.length,
      }),
      ip_address: getClientIp(request),
    });

    return jsonResponse({
      computation_id: computationId,
      version: nextVersion,
      computed_at: now,
      cached: false,
      results,
    });
  } catch (err) {
    // If a Response was thrown (e.g., from requireTenantAccess), return it
    if (err instanceof Response) {
      return err;
    }

    const message = err instanceof Error ? err.message : 'Computation failed';
    return errorResponse(message, 500);
  }
}

// ─── Get Latest Computation (used by NBA handler) ──────────────────────────

export async function getLatestComputation(
  db: D1Database,
  trustId: string
): Promise<{ id: string; results: ComputeResults; computed_at: string; version: number } | null> {
  const row = await db
    .prepare(
      `SELECT id, results, computed_at, version
       FROM computations
       WHERE trust_id = ?
       ORDER BY computed_at DESC
       LIMIT 1`
    )
    .bind(trustId)
    .first<{ id: string; results: string; computed_at: string; version: number }>();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    results: JSON.parse(row.results) as ComputeResults,
    computed_at: row.computed_at,
    version: row.version,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Deterministic hash of the compute inputs for cache invalidation */
async function hashInput(input: ComputeInput): Promise<string> {
  // Create a stable, sorted JSON representation of the inputs
  const stable = JSON.stringify({
    trust_id: input.trust.id,
    trust_updated: input.trust.updated_at,
    assets: input.assets
      .map(a => ({ id: a.id, u: a.updated_at }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    documents: input.documents
      .map(d => ({ id: d.id, u: d.updated_at }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    evidence: input.evidence
      .map(e => ({ id: e.id, u: e.uploaded_at }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(stable);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `sha256:${hashHex}`;
}

/** Safely parse a JSON array string, returning [] on failure */
function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Determine the trigger source from the request */
function getTriggerSource(request: Request): string {
  // Check for an explicit trigger query parameter or header
  const url = new URL(request.url);
  const trigger = url.searchParams.get('trigger');
  if (trigger && ['manual', 'asset_change', 'document_change', 'schedule'].includes(trigger)) {
    return trigger;
  }

  // Default to manual
  return 'manual';
}
