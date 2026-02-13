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
      `SELECT id, user_id, trust_name, trust_type, jurisdiction,
              county, date_established, date_last_amended,
              grantor_names, trustee_names, successor_trustee_names, beneficiary_names,
              estimated_estate_value, has_pour_over_will, has_power_of_attorney,
              has_healthcare_directive, status, notes, created_at, updated_at
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
        estimated_estate_value: number | null;
        has_pour_over_will: number;
        has_power_of_attorney: number;
        has_healthcare_directive: number;
        status: string;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!trustRow) {
      return errorResponse('Trust profile not found', 404);
    }

    // Parse JSON array fields and convert SQLite booleans
    const trust: TrustProfile = {
      ...trustRow,
      trust_type: trustRow.trust_type as TrustProfile['trust_type'],
      grantor_names: safeParseArray(trustRow.grantor_names),
      trustee_names: safeParseArray(trustRow.trustee_names),
      successor_trustee_names: safeParseArray(trustRow.successor_trustee_names),
      beneficiary_names: safeParseArray(trustRow.beneficiary_names),
      estimated_estate_value: trustRow.estimated_estate_value,
      has_pour_over_will: !!trustRow.has_pour_over_will,
      has_power_of_attorney: !!trustRow.has_power_of_attorney,
      has_healthcare_directive: !!trustRow.has_healthcare_directive,
      status: trustRow.status as TrustProfile['status'],
    };

    // Load all assets for this trust
    const assetsResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, name, asset_type, subtype, estimated_value,
              ownership_status, funding_method, beneficiary_designation, intended_beneficiary,
              location_address, account_number_last4, institution, notes, created_at, updated_at
       FROM asset
       WHERE trust_id = ?`
    )
      .bind(trustId)
      .all<AssetRow>();

    const assets: AssetRow[] = assetsResult.results;

    // Load all documents for this trust
    const documentsResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, title, doc_type, status, file_url, file_hash,
              page_count, date_signed, date_notarized, expiration_date,
              required, weight, linked_asset_id, notes, created_at, updated_at
       FROM document
       WHERE trust_id = ?`
    )
      .bind(trustId)
      .all<DocumentRow>();

    const documents: DocumentRow[] = documentsResult.results;

    // Load all evidence for this trust
    const evidenceResult = await env.DB.prepare(
      `SELECT id, trust_id, user_id, evidence_type, related_asset_id, related_doc_id,
              description, file_url, file_hash, file_name, file_key, mime_type, file_size,
              verified, verified_by, verified_at, notes, created_at
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

    // Note: input_hash caching is not supported in the current schema.
    // Each compute request generates a new computation record.

    // Run the deterministic scoring engine
    const results: ComputeResults = computeTrustHealth(computeInput);

    // Store computation snapshot
    const computationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Determine the latest version number
    const versionRow = await env.DB.prepare(
      `SELECT MAX(version) AS max_version FROM computation WHERE trust_id = ?`
    )
      .bind(trustId)
      .first<{ max_version: number | null }>();

    const nextVersion = (versionRow?.max_version ?? 0) + 1;

    // Determine trigger source
    const trigger = getTriggerSource(request);

    // Schema columns: id, trust_id, computed_at, trust_health_score, funding_coverage_pct,
    //                  probate_exposure, document_completeness_pct, incapacity_readiness_pct, results, version
    await env.DB.prepare(
      `INSERT INTO computation (id, trust_id, computed_at, trust_health_score, funding_coverage_pct,
       probate_exposure, document_completeness_pct, incapacity_readiness_pct, results, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        computationId,
        trustId,
        now,
        results.funding_coverage_value_pct ?? 0,
        results.funding_coverage_count_pct ?? 0,
        results.probate_exposure_amount ?? 0,
        results.document_completeness_score ?? 0,
        results.incapacity_readiness_score ?? 0,
        JSON.stringify(results),
        nextVersion
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
       FROM computation
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
