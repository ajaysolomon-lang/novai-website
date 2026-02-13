/**
 * AliveTrust — Next Best Action (NBA) API Handler
 *
 * Loads the latest computation results (or triggers a fresh compute),
 * runs the NBA evaluation engine against the static rule set, and
 * returns the prioritized top 3 actions and backlog.
 *
 * Side effects (DB reads, compute triggering) live here — never in
 * the NBA engine itself.
 */

import type { Env, SessionData, TrustProfile } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit, getClientIp } from '../middleware/audit';
import { jsonResponse, errorResponse } from '../utils/response';
import { getLatestComputation } from '../compute/handlers';
import { computeTrustHealth, type AssetRow, type DocumentRow, type EvidenceRow } from '../compute/engine';
import { evaluateNBAs, type NBAInput, type NBAOutput } from './engine';
import { NBA_RULES_V1 } from './rules';

// ─── NBA Handler ───────────────────────────────────────────────────────────

export async function nextBestActions(
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

    // Try to get the latest computation
    let computation = await getLatestComputation(env.DB, trustId);

    // If no computation exists, trigger a fresh one
    if (!computation) {
      const freshResults = await triggerFreshCompute(env, trustId, session);
      if (!freshResults) {
        return errorResponse(
          'No computation results available and unable to compute. Please ensure the trust has assets and documents.',
          404
        );
      }
      computation = freshResults;
    }

    // Load trust profile for NBA context
    const trustRow = await env.DB.prepare(
      `SELECT id, user_id, name AS trust_name, type AS trust_type, state AS jurisdiction,
              county, date_created AS date_established,
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

    const trust: TrustProfile = {
      ...trustRow,
      trust_type: trustRow.trust_type as TrustProfile['trust_type'],
      grantor_names: safeParseArray(trustRow.grantor_names),
      trustee_names: safeParseArray(trustRow.trustee_names),
      successor_trustee_names: safeParseArray(trustRow.successor_trustee_names),
      beneficiary_names: safeParseArray(trustRow.beneficiary_names),
      estimated_estate_value: null,
      has_pour_over_will: false,
      has_power_of_attorney: false,
      has_healthcare_directive: false,
      status: 'active' as const,
    };

    // Build NBA input
    const nbaInput: NBAInput = {
      computeResults: computation.results,
      trust,
      rules: NBA_RULES_V1,
    };

    // Evaluate NBAs (pure function, no side effects)
    const nbaOutput: NBAOutput = evaluateNBAs(nbaInput);

    // Log audit entry
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'compute',
      entity_type: 'nba',
      entity_id: computation.id,
      details: JSON.stringify({
        computation_id: computation.id,
        computation_version: computation.version,
        top3_rules: nbaOutput.top3.map(a => a.rule_id),
        backlog_count: nbaOutput.backlog.length,
        total_actions: nbaOutput.top3.length + nbaOutput.backlog.length,
      }),
      ip_address: getClientIp(request),
    });

    return jsonResponse({
      computation_id: computation.id,
      computed_at: computation.computed_at,
      computation_version: computation.version,
      top3: nbaOutput.top3,
      backlog: nbaOutput.backlog,
      rules_version: 'v1',
      total_actions: nbaOutput.top3.length + nbaOutput.backlog.length,
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }

    const message = err instanceof Error ? err.message : 'NBA evaluation failed';
    return errorResponse(message, 500);
  }
}

// ─── Fresh Compute (used when no prior computation exists) ─────────────────

async function triggerFreshCompute(
  env: Env,
  trustId: string,
  session: SessionData
): Promise<{ id: string; results: import('../types/index').ComputeResults; computed_at: string; version: number } | null> {
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
      grantor_names: string | null;
      trustee_names: string | null;
      successor_trustee_names: string | null;
      beneficiary_names: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>();

  if (!trustRow) return null;

  const trust: TrustProfile = {
    ...trustRow,
    trust_type: trustRow.trust_type as TrustProfile['trust_type'],
    grantor_names: safeParseArray(trustRow.grantor_names),
    trustee_names: safeParseArray(trustRow.trustee_names),
    successor_trustee_names: safeParseArray(trustRow.successor_trustee_names),
    beneficiary_names: safeParseArray(trustRow.beneficiary_names),
    estimated_estate_value: null,
    has_pour_over_will: false,
    has_power_of_attorney: false,
    has_healthcare_directive: false,
    status: 'active' as const,
  };

  // Load assets (use schema column names: asset_type, ownership_status)
  const assetsResult = await env.DB.prepare(
    `SELECT id, trust_id, user_id, name, asset_type, subtype, estimated_value,
            ownership_status, funding_method, beneficiary_designation, intended_beneficiary,
            location_address, account_number_last4, institution, notes, created_at, updated_at
     FROM asset WHERE trust_id = ?`
  )
    .bind(trustId)
    .all<AssetRow>();

  // Load documents (use schema column names: title, expiration_date)
  const documentsResult = await env.DB.prepare(
    `SELECT id, trust_id, user_id, title, doc_type, status, file_url, file_hash,
            page_count, date_signed, date_notarized, expiration_date,
            required, weight, linked_asset_id, notes, created_at, updated_at
     FROM document WHERE trust_id = ?`
  )
    .bind(trustId)
    .all<DocumentRow>();

  // Load evidence (use schema column names: evidence_type, related_asset_id, related_doc_id)
  const evidenceResult = await env.DB.prepare(
    `SELECT id, trust_id, user_id, evidence_type, related_asset_id, related_doc_id,
            description, file_url, file_hash, file_name, file_key, mime_type, file_size,
            verified, verified_by, verified_at, notes, created_at
     FROM evidence WHERE trust_id = ?`
  )
    .bind(trustId)
    .all<EvidenceRow>();

  const computeInput = {
    trust,
    assets: assetsResult.results,
    documents: documentsResult.results,
    evidence: evidenceResult.results,
  };

  // Run computation
  const results = computeTrustHealth(computeInput);

  // Store the computation
  const computationId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Schema columns: id, trust_id, computed_at, trust_health_score, funding_coverage_pct,
  //                  probate_exposure, document_completeness_pct, incapacity_readiness_pct, results, version
  await env.DB.prepare(
    `INSERT INTO computation (id, trust_id, computed_at, trust_health_score, funding_coverage_pct,
     probate_exposure, document_completeness_pct, incapacity_readiness_pct, results, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
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
      JSON.stringify(results)
    )
    .run();

  return {
    id: computationId,
    results,
    computed_at: now,
    version: 1,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
