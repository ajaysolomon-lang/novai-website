import type { Env, SessionData, ComputeResults, RedFlag, DataGap, NBAAction } from '../types/index';
import { verifyTenantAccess } from '../middleware/tenant';
import { logAudit } from '../middleware/audit';
import { jsonResponse, errorResponse, forbiddenResponse, notFoundResponse } from '../utils/response';

// ─── Legal Disclaimer ────────────────────────────────────────────────────────

const LEGAL_DISCLAIMER =
  'This information is for educational purposes only and does not constitute ' +
  'legal advice. Consult a qualified attorney for guidance specific to your situation. ' +
  'Scores and assessments are based on user-provided data and may not reflect the ' +
  'complete legal status of your trust.';

// ─── Report Interfaces ──────────────────────────────────────────────────────

interface HealthReport {
  generated_at: string;
  trust_name: string;
  trust_type: string;
  state: string;
  scores: {
    funding_coverage_value: { score: number; formula: string };
    funding_coverage_count: { score: number; formula: string };
    probate_exposure: { amount: number; assets: string[] };
    document_completeness: { score: number; formula: string };
    incapacity_readiness: { score: number; formula: string };
    evidence_completeness: { score: number; formula: string };
  };
  red_flags: RedFlag[];
  data_gaps: DataGap[];
  next_actions: NBAAction[];
  evidence_index: {
    evidence_id: string;
    file_name: string;
    type: string;
    linked_to: string;
  }[];
  disclaimer: string;
}

interface TrusteePacket {
  generated_at: string;
  trust_summary: {
    name: string;
    type: string;
    date_created: string;
    state: string;
    county: string;
  };
  trustees: { current: string[]; successor: string[] };
  beneficiaries: string[];
  key_contacts: { role: string; name: string; notes: string }[];
  asset_summary: {
    name: string;
    type: string;
    value: number;
    funding_status: string;
  }[];
  evidence_index: {
    evidence_id: string;
    file_name: string;
    type: string;
  }[];
  break_glass_instructions: string;
  disclaimer: string;
}

// ─── Break-Glass Instructions Template ───────────────────────────────────────

const BREAK_GLASS_INSTRUCTIONS = `EMERGENCY INSTRUCTIONS FOR SUCCESSOR TRUSTEE

If you are reading this because the grantor(s) have become incapacitated or
have passed away, follow these steps:

1. SECURE THE TRUST DOCUMENT
   - Locate the original signed trust agreement and all amendments.
   - Obtain certified copies of the death certificate (if applicable) or
     physician's letter of incapacity.

2. NOTIFY KEY PARTIES
   - Contact the estate attorney listed in Key Contacts.
   - Notify all named beneficiaries of your role as successor trustee.
   - Inform financial institutions that hold trust assets.

3. DO NOT DISTRIBUTE ASSETS YET
   - Do not make any distributions until you have consulted with the
     estate attorney and confirmed your authority as successor trustee.

4. SECURE ALL ASSETS
   - Change passwords on financial accounts (with attorney guidance).
   - Ensure real property is maintained and insured.
   - Collect any mail and redirect as needed.

5. OBTAIN AN EIN
   - If the trust becomes irrevocable upon grantor's death, you will need
     a new Employer Identification Number (EIN) from the IRS.

6. FILE REQUIRED NOTICES
   - Your attorney will advise on any required notices to beneficiaries
     and creditors under your state's trust administration laws.

7. KEEP DETAILED RECORDS
   - Document all actions, expenditures, and communications.
   - You have a fiduciary duty to act in the best interests of the
     beneficiaries.

This checklist is for general guidance only. Your specific situation may
require additional steps. Always work with a qualified attorney.`;

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /trusts/:trust_id/export/health-report
 *
 * Generate a comprehensive trust health report as structured JSON.
 * The frontend can render this to PDF or the user can print it directly.
 *
 * Loads the trust profile, latest computation results, evidence records,
 * and NBA actions to build a complete picture of the trust's health status.
 */
export async function healthReport(
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

    // Load the trust profile.
    const trust = await env.DB
      .prepare(
        `SELECT id, name, type, state, county, date_created,
                grantor_names, trustee_names, successor_trustee_names,
                beneficiary_names
         FROM trust_profile
         WHERE id = ?`
      )
      .bind(trustId)
      .first<{
        id: string;
        name: string;
        type: string;
        state: string;
        county: string | null;
        date_created: string | null;
        grantor_names: string | null;
        trustee_names: string | null;
        successor_trustee_names: string | null;
        beneficiary_names: string | null;
      }>();

    if (!trust) {
      return notFoundResponse('Trust profile');
    }

    // Load the latest computation.
    const computation = await env.DB
      .prepare(
        `SELECT id, computed_at, version, results
         FROM computations
         WHERE trust_id = ?
         ORDER BY computed_at DESC
         LIMIT 1`
      )
      .bind(trustId)
      .first<{
        id: string;
        computed_at: string;
        version: number;
        results: string;
      }>();

    // Parse computation results (may be null if no computation has run yet).
    let computeResults: ComputeResults | null = null;
    if (computation?.results) {
      try {
        computeResults = JSON.parse(computation.results) as ComputeResults;
      } catch {
        // If parsing fails, continue with null results.
        computeResults = null;
      }
    }

    // Load evidence records for the evidence index.
    const evidenceRows = await env.DB
      .prepare(
        `SELECT e.id, e.file_name, e.type, e.linked_asset_id, e.linked_doc_id,
                a.name as asset_name, d.name as doc_name
         FROM evidence e
         LEFT JOIN assets a ON a.id = e.linked_asset_id
         LEFT JOIN documents d ON d.id = e.linked_doc_id
         WHERE e.trust_id = ?
         ORDER BY e.uploaded_at DESC`
      )
      .bind(trustId)
      .all<{
        id: string;
        file_name: string | null;
        type: string;
        linked_asset_id: string | null;
        linked_doc_id: string | null;
        asset_name: string | null;
        doc_name: string | null;
      }>();

    const evidence = evidenceRows.results ?? [];

    // Build the evidence index.
    const evidenceIndex = evidence.map((e) => {
      let linkedTo = 'Unlinked';
      if (e.asset_name) {
        linkedTo = `Asset: ${e.asset_name}`;
      } else if (e.doc_name) {
        linkedTo = `Document: ${e.doc_name}`;
      }
      return {
        evidence_id: e.id,
        file_name: e.file_name ?? 'Unknown file',
        type: e.type,
        linked_to: linkedTo,
      };
    });

    // Build scores from computation results (or defaults if no computation).
    const scores = computeResults
      ? {
          funding_coverage_value: {
            score: computeResults.funding_coverage_value_pct,
            formula: computeResults.formulas?.funding_coverage_value ?? 'funded_value / total_value * 100',
          },
          funding_coverage_count: {
            score: computeResults.funding_coverage_count_pct,
            formula: computeResults.formulas?.funding_coverage_count ?? 'funded_count / total_count * 100',
          },
          probate_exposure: {
            amount: computeResults.probate_exposure_amount,
            assets: computeResults.probate_exposure_assets,
          },
          document_completeness: {
            score: computeResults.document_completeness_score,
            formula: computeResults.formulas?.document_completeness ?? 'weighted_complete / weighted_total * 100',
          },
          incapacity_readiness: {
            score: computeResults.incapacity_readiness_score,
            formula: computeResults.formulas?.incapacity_readiness ?? 'incapacity_docs_complete / incapacity_docs_required * 100',
          },
          evidence_completeness: {
            score: computeResults.evidence_completeness_pct,
            formula: computeResults.formulas?.evidence_completeness ?? 'verified_evidence / total_expected * 100',
          },
        }
      : {
          funding_coverage_value: { score: 0, formula: 'No computation data available' },
          funding_coverage_count: { score: 0, formula: 'No computation data available' },
          probate_exposure: { amount: 0, assets: [] },
          document_completeness: { score: 0, formula: 'No computation data available' },
          incapacity_readiness: { score: 0, formula: 'No computation data available' },
          evidence_completeness: { score: 0, formula: 'No computation data available' },
        };

    const report: HealthReport = {
      generated_at: new Date().toISOString(),
      trust_name: trust.name,
      trust_type: trust.type,
      state: trust.state,
      scores,
      red_flags: computeResults?.red_flags ?? [],
      data_gaps: computeResults?.data_gaps ?? [],
      next_actions: [], // NBA actions would be computed separately; empty for now.
      evidence_index: evidenceIndex,
      disclaimer: LEGAL_DISCLAIMER,
    };

    // Log the export action for audit trail — logAudit expects Omit<AuditLogEntry, 'id' | 'created_at'>
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'export',
      entity_type: 'health_report',
      entity_id: trustId,
      details: JSON.stringify({ generated_at: report.generated_at }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate health report';
    return errorResponse(message, 500);
  }
}

/**
 * GET /trusts/:trust_id/export/trustee-packet
 *
 * Generate a trustee packet — a comprehensive summary intended for a
 * successor trustee to reference in the event of grantor incapacity or death.
 *
 * Includes trust summary, all parties, asset inventory, evidence index,
 * and break-glass emergency instructions.
 */
export async function trusteePacket(
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

    // Load the trust profile.
    const trust = await env.DB
      .prepare(
        `SELECT id, name, type, state, county, date_created,
                grantor_names, trustee_names, successor_trustee_names,
                beneficiary_names, notes
         FROM trust_profile
         WHERE id = ?`
      )
      .bind(trustId)
      .first<{
        id: string;
        name: string;
        type: string;
        state: string;
        county: string | null;
        date_created: string | null;
        grantor_names: string | null;
        trustee_names: string | null;
        successor_trustee_names: string | null;
        beneficiary_names: string | null;
        notes: string | null;
      }>();

    if (!trust) {
      return notFoundResponse('Trust profile');
    }

    // Parse JSON array fields.
    const grantorNames: string[] = trust.grantor_names ? JSON.parse(trust.grantor_names) : [];
    const trusteeNames: string[] = trust.trustee_names ? JSON.parse(trust.trustee_names) : [];
    const successorTrusteeNames: string[] = trust.successor_trustee_names
      ? JSON.parse(trust.successor_trustee_names)
      : [];
    const beneficiaryNames: string[] = trust.beneficiary_names
      ? JSON.parse(trust.beneficiary_names)
      : [];

    // Load all assets for the trust.
    const assetRows = await env.DB
      .prepare(
        `SELECT id, name, type, estimated_value, funding_status
         FROM assets
         WHERE trust_id = ?
         ORDER BY estimated_value DESC`
      )
      .bind(trustId)
      .all<{
        id: string;
        name: string;
        type: string;
        estimated_value: number | null;
        funding_status: string;
      }>();

    const assets = assetRows.results ?? [];

    // Load evidence records for the evidence index.
    const evidenceRows = await env.DB
      .prepare(
        `SELECT id, file_name, type
         FROM evidence
         WHERE trust_id = ?
         ORDER BY uploaded_at DESC`
      )
      .bind(trustId)
      .all<{
        id: string;
        file_name: string | null;
        type: string;
      }>();

    const evidenceRecords = evidenceRows.results ?? [];

    // Build key contacts from the people involved.
    // In a full implementation, this would pull from a dedicated contacts table.
    // MVP: derive from trust profile data.
    const keyContacts: { role: string; name: string; notes: string }[] = [];

    for (const name of grantorNames) {
      keyContacts.push({ role: 'Grantor', name, notes: '' });
    }
    for (const name of trusteeNames) {
      keyContacts.push({ role: 'Current Trustee', name, notes: '' });
    }
    for (const name of successorTrusteeNames) {
      keyContacts.push({ role: 'Successor Trustee', name, notes: '' });
    }

    // Build the trustee packet.
    const packet: TrusteePacket = {
      generated_at: new Date().toISOString(),
      trust_summary: {
        name: trust.name,
        type: trust.type,
        date_created: trust.date_created ?? 'Not specified',
        state: trust.state,
        county: trust.county ?? 'Not specified',
      },
      trustees: {
        current: trusteeNames,
        successor: successorTrusteeNames,
      },
      beneficiaries: beneficiaryNames,
      key_contacts: keyContacts,
      asset_summary: assets.map((a) => ({
        name: a.name,
        type: a.type,
        value: a.estimated_value ?? 0,
        funding_status: a.funding_status,
      })),
      evidence_index: evidenceRecords.map((e) => ({
        evidence_id: e.id,
        file_name: e.file_name ?? 'Unknown file',
        type: e.type,
      })),
      break_glass_instructions: BREAK_GLASS_INSTRUCTIONS,
      disclaimer: LEGAL_DISCLAIMER,
    };

    // Log the export action for audit trail — logAudit expects Omit<AuditLogEntry, 'id' | 'created_at'>
    await logAudit(env.DB, {
      trust_id: trustId,
      user_id: session.user_id,
      action: 'export',
      entity_type: 'trustee_packet',
      entity_id: trustId,
      details: JSON.stringify({ generated_at: packet.generated_at }),
      ip_address: request.headers.get('CF-Connecting-IP') ?? null,
    });

    return jsonResponse(packet);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate trustee packet';
    return errorResponse(message, 500);
  }
}
