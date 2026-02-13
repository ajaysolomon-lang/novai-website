/**
 * AliveTrust — Deterministic Trust Health Scoring Engine
 *
 * Pure function. No LLM calls. No randomness. No side effects.
 * Given structured data about a trust, its assets, documents, and evidence,
 * returns a fully-populated ComputeResults object with scores, formulas,
 * contributing IDs, red flags, and data gaps.
 *
 * Every numeric result includes a human-readable formula string so the user
 * (and any auditor) can trace exactly how the number was derived.
 */

import type {
  TrustProfile,
  ComputeResults,
  RedFlag,
  DataGap,
} from '../types/index';

// ─── DB Row Types ──────────────────────────────────────────────────────────
// These match the actual D1 column names from the schema, which differ
// slightly from the higher-level TypeScript interfaces in types/index.ts.
// The handlers query the DB and pass these rows directly into the engine.

export interface AssetRow {
  id: string;
  trust_id: string;
  user_id: string;
  name: string;
  type: 'real_estate' | 'financial' | 'insurance' | 'business' | 'retirement' | 'personal_property' | 'digital' | 'other';
  subtype: string | null;
  estimated_value: number | null;
  funding_status: 'funded' | 'unfunded' | 'partial' | 'unknown';
  funding_method: string | null;
  beneficiary_designation: string | null;
  intended_beneficiary: string | null;
  location_address: string | null;
  account_number_last4: string | null;
  institution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  trust_id: string;
  user_id: string;
  name: string;
  doc_type: 'trust_document' | 'amendment' | 'pour_over_will' | 'financial_poa' | 'healthcare_directive' | 'certificate_of_trust' | 'property_deed' | 'beneficiary_form' | 'account_title_change' | 'operating_agreement' | 'insurance_policy' | 'tax_return' | 'other';
  status: 'complete' | 'missing' | 'outdated' | 'needs_review';
  date_signed: string | null;
  date_expires: string | null;
  required: number; // 0 or 1 (SQLite boolean)
  weight: number;
  linked_asset_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceRow {
  id: string;
  trust_id: string;
  user_id: string;
  linked_asset_id: string | null;
  linked_doc_id: string | null;
  type: string;
  file_name: string | null;
  file_key: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  verified: number; // 0 or 1
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

// ─── Engine Input ──────────────────────────────────────────────────────────

export interface ComputeInput {
  trust: TrustProfile;
  assets: AssetRow[];
  documents: DocumentRow[];
  evidence: EvidenceRow[];
}

// ─── Document Weights ──────────────────────────────────────────────────────
// Base weights for required document types. Property deeds are dynamically
// added based on the count of real_estate assets.

const BASE_DOC_WEIGHTS: Record<string, number> = {
  trust_document: 3,
  pour_over_will: 2,
  financial_poa: 2.5,
  healthcare_directive: 2,
  certificate_of_trust: 1.5,
};

const PROPERTY_DEED_WEIGHT = 2;

// ─── Asset Type Helpers ────────────────────────────────────────────────────

/** Asset types excluded from funding coverage (value) — they pass by beneficiary designation */
const EXCLUDED_FROM_VALUE_FUNDING: Set<string> = new Set(['retirement']);

/** Asset types excluded from funding coverage (count) — they pass by beneficiary, not title */
const EXCLUDED_FROM_COUNT_FUNDING: Set<string> = new Set(['retirement', 'insurance']);

/** Asset types excluded from probate exposure */
const EXCLUDED_FROM_PROBATE: Set<string> = new Set(['retirement', 'insurance']);

// ─── Main Compute Function ─────────────────────────────────────────────────

export function computeTrustHealth(input: ComputeInput): ComputeResults {
  const { trust, assets, documents, evidence } = input;

  // Compute each metric
  const fundingValue = computeFundingCoverageValue(assets);
  const fundingCount = computeFundingCoverageCount(assets);
  const probate = computeProbateExposure(assets);
  const docCompleteness = computeDocumentCompleteness(documents, assets);
  const incapacity = computeIncapacityReadiness(documents, trust);
  const evidenceScore = computeEvidenceCompleteness(assets, documents, evidence);
  const redFlags = detectRedFlags(assets, documents, trust);
  const dataGaps = detectDataGaps(assets, documents, trust);

  return {
    funding_coverage_value_pct: fundingValue.score,
    funding_coverage_count_pct: fundingCount.score,
    probate_exposure_amount: probate.amount,
    probate_exposure_assets: probate.assetIds,
    document_completeness_score: docCompleteness.score,
    incapacity_readiness_score: incapacity.score,
    evidence_completeness_pct: evidenceScore.score,
    red_flags: redFlags,
    formulas: {
      funding_coverage_value: fundingValue.formula,
      funding_coverage_count: fundingCount.formula,
      probate_exposure: probate.formula,
      document_completeness: docCompleteness.formula,
      incapacity_readiness: incapacity.formula,
      evidence_completeness: evidenceScore.formula,
    },
    contributing_asset_ids: {
      funded_value: fundingValue.contributingAssetIds,
      funded_count: fundingCount.contributingAssetIds,
      probate_exposed: probate.assetIds,
      evidence_covered_assets: evidenceScore.coveredAssetIds,
    },
    contributing_evidence_ids: {
      asset_evidence: evidenceScore.assetEvidenceIds,
      document_evidence: evidenceScore.docEvidenceIds,
    },
    data_gaps: dataGaps,
  };
}

// ─── (a) Funding Coverage by Value ─────────────────────────────────────────

interface FundingValueResult {
  score: number;
  formula: string;
  contributingAssetIds: string[];
}

function computeFundingCoverageValue(assets: AssetRow[]): FundingValueResult {
  // Exclude retirement accounts from this metric
  const eligible = assets.filter(a => !EXCLUDED_FROM_VALUE_FUNDING.has(a.type));

  if (eligible.length === 0) {
    return {
      score: 0,
      formula: 'No eligible assets (retirement accounts excluded). 0 / 0 = 0%',
      contributingAssetIds: [],
    };
  }

  const totalValue = eligible.reduce((sum, a) => sum + (a.estimated_value ?? 0), 0);

  if (totalValue === 0) {
    return {
      score: 0,
      formula: 'Total eligible asset value is $0. 0 / 0 = 0%',
      contributingAssetIds: [],
    };
  }

  const fundedAssets = eligible.filter(a => a.funding_status === 'funded');
  const fundedValue = fundedAssets.reduce((sum, a) => sum + (a.estimated_value ?? 0), 0);
  const pct = round2(fundedValue / totalValue * 100);

  const contributingAssetIds = fundedAssets.map(a => a.id);

  const formula =
    `funded_value / total_value = $${fmt(fundedValue)} / $${fmt(totalValue)} = ${pct}%`;

  return { score: pct, formula, contributingAssetIds };
}

// ─── (b) Funding Coverage by Count ─────────────────────────────────────────

interface FundingCountResult {
  score: number;
  formula: string;
  contributingAssetIds: string[];
}

function computeFundingCoverageCount(assets: AssetRow[]): FundingCountResult {
  // Exclude retirement and insurance (they pass by beneficiary designation)
  const eligible = assets.filter(a => !EXCLUDED_FROM_COUNT_FUNDING.has(a.type));

  if (eligible.length === 0) {
    return {
      score: 0,
      formula: 'No fundable assets (retirement and insurance excluded). 0 / 0 = 0%',
      contributingAssetIds: [],
    };
  }

  const fundedAssets = eligible.filter(a => a.funding_status === 'funded');
  const pct = round2(fundedAssets.length / eligible.length * 100);

  const contributingAssetIds = fundedAssets.map(a => a.id);

  const formula =
    `funded_count / total_fundable = ${fundedAssets.length} / ${eligible.length} = ${pct}%`;

  return { score: pct, formula, contributingAssetIds };
}

// ─── (c) Probate Exposure ──────────────────────────────────────────────────

interface ProbateResult {
  amount: number;
  assetIds: string[];
  formula: string;
}

function computeProbateExposure(assets: AssetRow[]): ProbateResult {
  // Unfunded assets that are NOT retirement/insurance
  const exposed = assets.filter(
    a => !EXCLUDED_FROM_PROBATE.has(a.type) && a.funding_status !== 'funded'
  );

  if (exposed.length === 0) {
    return {
      amount: 0,
      assetIds: [],
      formula: 'No unfunded assets exposed to probate. $0',
    };
  }

  const parts: string[] = [];
  let total = 0;

  for (const a of exposed) {
    const val = a.estimated_value ?? 0;
    total += val;
    parts.push(`${a.name} ($${fmt(val)})`);
  }

  const formula = `sum of unfunded asset values: ${parts.join(' + ')} = $${fmt(total)}`;

  return {
    amount: total,
    assetIds: exposed.map(a => a.id),
    formula,
  };
}

// ─── (d) Document Completeness ─────────────────────────────────────────────

interface DocCompletenessResult {
  score: number;
  formula: string;
}

function computeDocumentCompleteness(
  documents: DocumentRow[],
  assets: AssetRow[]
): DocCompletenessResult {
  // Build required document map with weights
  // Start with base required docs
  const requiredDocs: Array<{ docType: string; weight: number; label: string }> = [];

  for (const [docType, weight] of Object.entries(BASE_DOC_WEIGHTS)) {
    requiredDocs.push({ docType, weight, label: docType });
  }

  // Dynamically add property_deed requirements based on real_estate count
  const realEstateAssets = assets.filter(a => a.type === 'real_estate');
  for (let i = 0; i < realEstateAssets.length; i++) {
    requiredDocs.push({
      docType: 'property_deed',
      weight: PROPERTY_DEED_WEIGHT,
      label: `property_deed[${realEstateAssets[i].name}]`,
    });
  }

  if (requiredDocs.length === 0) {
    return {
      score: 0,
      formula: 'No required documents defined. 0%',
    };
  }

  const totalWeight = requiredDocs.reduce((sum, d) => sum + d.weight, 0);
  const formulaParts: string[] = [];
  let earnedWeight = 0;

  for (const req of requiredDocs) {
    let matched: DocumentRow | undefined;

    if (req.docType === 'property_deed') {
      // For property deeds, match by doc_type AND linked_asset_id
      const assetIndex = requiredDocs
        .filter(r => r.docType === 'property_deed')
        .indexOf(req);
      const targetAsset = realEstateAssets[assetIndex];

      if (targetAsset) {
        matched = documents.find(
          d => d.doc_type === 'property_deed' &&
               d.linked_asset_id === targetAsset.id &&
               d.status === 'complete'
        );
      }
    } else {
      // For other doc types, find any complete document of that type
      matched = documents.find(
        d => d.doc_type === req.docType && d.status === 'complete'
      );
    }

    if (matched) {
      earnedWeight += req.weight;
      formulaParts.push(`${req.label}: ${req.weight}/${req.weight} (complete)`);
    } else {
      formulaParts.push(`${req.label}: 0/${req.weight} (missing/incomplete)`);
    }
  }

  const pct = totalWeight > 0 ? round2(earnedWeight / totalWeight * 100) : 0;
  const formula =
    `${formulaParts.join(', ')} => ${earnedWeight}/${totalWeight} = ${pct}%`;

  return { score: pct, formula };
}

// ─── (e) Incapacity Readiness ──────────────────────────────────────────────

interface IncapacityResult {
  score: number;
  formula: string;
}

function computeIncapacityReadiness(
  documents: DocumentRow[],
  trust: TrustProfile
): IncapacityResult {
  const components: Array<{ name: string; weight: number; earned: number }> = [];

  // Healthcare directive (30%)
  const hasHealthcare = documents.some(
    d => d.doc_type === 'healthcare_directive' && d.status === 'complete'
  );
  components.push({
    name: 'healthcare_directive',
    weight: 30,
    earned: hasHealthcare ? 30 : 0,
  });

  // Financial POA (30%)
  const hasPOA = documents.some(
    d => d.doc_type === 'financial_poa' && d.status === 'complete'
  );
  components.push({
    name: 'financial_poa',
    weight: 30,
    earned: hasPOA ? 30 : 0,
  });

  // Successor trustee defined (20%)
  const hasSuccessor =
    Array.isArray(trust.successor_trustee_names) &&
    trust.successor_trustee_names.length > 0;
  components.push({
    name: 'successor_trustee',
    weight: 20,
    earned: hasSuccessor ? 20 : 0,
  });

  // Certificate of trust (20%)
  const hasCert = documents.some(
    d => d.doc_type === 'certificate_of_trust' && d.status === 'complete'
  );
  components.push({
    name: 'certificate_of_trust',
    weight: 20,
    earned: hasCert ? 20 : 0,
  });

  const totalEarned = components.reduce((sum, c) => sum + c.earned, 0);
  const formulaParts = components.map(
    c => `${c.name}: ${c.earned}/${c.weight}`
  );
  const formula = `${formulaParts.join(' + ')} = ${totalEarned}/100 = ${totalEarned}%`;

  return { score: totalEarned, formula };
}

// ─── (f) Evidence Completeness ─────────────────────────────────────────────

interface EvidenceResult {
  score: number;
  formula: string;
  coveredAssetIds: string[];
  assetEvidenceIds: string[];
  docEvidenceIds: string[];
}

function computeEvidenceCompleteness(
  assets: AssetRow[],
  documents: DocumentRow[],
  evidenceItems: EvidenceRow[]
): EvidenceResult {
  // For each asset: does it have at least one linked evidence item?
  const assetsWithEvidence = new Set<string>();
  const assetEvidenceIds: string[] = [];

  for (const e of evidenceItems) {
    if (e.linked_asset_id) {
      assetsWithEvidence.add(e.linked_asset_id);
      assetEvidenceIds.push(e.id);
    }
  }

  // For each complete document: does it have at least one linked evidence item?
  const completeDocs = documents.filter(d => d.status === 'complete');
  const docsWithEvidence = new Set<string>();
  const docEvidenceIds: string[] = [];

  for (const e of evidenceItems) {
    if (e.linked_doc_id) {
      docsWithEvidence.add(e.linked_doc_id);
      docEvidenceIds.push(e.id);
    }
  }

  const totalItems = assets.length + completeDocs.length;
  if (totalItems === 0) {
    return {
      score: 0,
      formula: 'No assets or complete documents to verify. 0 / 0 = 0%',
      coveredAssetIds: [],
      assetEvidenceIds: [],
      docEvidenceIds: [],
    };
  }

  const coveredAssets = assets.filter(a => assetsWithEvidence.has(a.id));
  const coveredDocCount = completeDocs.filter(d => docsWithEvidence.has(d.id)).length;
  const coveredCount = coveredAssets.length + coveredDocCount;

  const pct = round2(coveredCount / totalItems * 100);

  const formula =
    `items_with_evidence / total_items = ` +
    `(${coveredAssets.length} assets + ${coveredDocCount} docs) / ` +
    `(${assets.length} assets + ${completeDocs.length} docs) = ` +
    `${coveredCount} / ${totalItems} = ${pct}%`;

  return {
    score: pct,
    formula,
    coveredAssetIds: coveredAssets.map(a => a.id),
    assetEvidenceIds: [...new Set(assetEvidenceIds)],
    docEvidenceIds: [...new Set(docEvidenceIds)],
  };
}

// ─── (g) Red Flag Detection ───────────────────────────────────────────────

function detectRedFlags(
  assets: AssetRow[],
  documents: DocumentRow[],
  trust: TrustProfile
): RedFlag[] {
  const flags: RedFlag[] = [];
  let flagCounter = 0;

  const nextId = (): string => {
    flagCounter++;
    return `rf-${flagCounter.toString().padStart(4, '0')}`;
  };

  // 1. unfunded_real_estate: Any real_estate with funding_status !== 'funded'
  const unfundedRealEstate = assets.filter(
    a => a.type === 'real_estate' && a.funding_status !== 'funded'
  );
  for (const a of unfundedRealEstate) {
    const value = a.estimated_value ?? 0;
    const severity = value >= 100000 ? 'critical' : 'high';
    flags.push({
      flag_id: nextId(),
      type: 'unfunded_real_estate',
      severity,
      message: `Real estate "${a.name}" (est. $${fmt(value)}) is not funded into the trust. This property will go through probate.`,
      related_asset_ids: [a.id],
      related_doc_ids: [],
    });
  }

  // 2. deed_recording_gap: Real estate exists but no complete property_deed
  const realEstateAssets = assets.filter(a => a.type === 'real_estate');
  for (const a of realEstateAssets) {
    const hasDeed = documents.some(
      d => d.doc_type === 'property_deed' &&
           d.linked_asset_id === a.id &&
           d.status === 'complete'
    );
    if (!hasDeed) {
      flags.push({
        flag_id: nextId(),
        type: 'deed_recording_gap',
        severity: 'high',
        message: `Real estate "${a.name}" has no complete recorded property deed on file.`,
        related_asset_ids: [a.id],
        related_doc_ids: [],
      });
    }
  }

  // 3. beneficiary_mismatch: beneficiary_designation exists AND intended_beneficiary
  //    exists AND they don't match
  for (const a of assets) {
    if (
      a.beneficiary_designation &&
      a.intended_beneficiary &&
      normalizeName(a.beneficiary_designation) !== normalizeName(a.intended_beneficiary)
    ) {
      flags.push({
        flag_id: nextId(),
        type: 'beneficiary_mismatch',
        severity: 'high',
        message: `Asset "${a.name}" has a beneficiary mismatch: designated "${a.beneficiary_designation}" but intended "${a.intended_beneficiary}".`,
        related_asset_ids: [a.id],
        related_doc_ids: [],
      });
    }
  }

  // 4. missing_successor_trustee
  if (
    !trust.successor_trustee_names ||
    !Array.isArray(trust.successor_trustee_names) ||
    trust.successor_trustee_names.length === 0
  ) {
    flags.push({
      flag_id: nextId(),
      type: 'missing_successor_trustee',
      severity: 'critical',
      message: 'No successor trustee is named. If the current trustee becomes incapacitated or dies, the trust may require court intervention.',
      related_asset_ids: [],
      related_doc_ids: [],
    });
  }

  // 5. missing_poa: No complete financial_poa
  const hasCompletePOA = documents.some(
    d => d.doc_type === 'financial_poa' && d.status === 'complete'
  );
  if (!hasCompletePOA) {
    flags.push({
      flag_id: nextId(),
      type: 'missing_poa',
      severity: 'critical',
      message: 'No complete Financial Power of Attorney on file. Without one, a court-appointed conservator may be needed to manage finances during incapacity.',
      related_asset_ids: [],
      related_doc_ids: [],
    });
  }

  // 6. missing_healthcare_directive
  const hasCompleteHD = documents.some(
    d => d.doc_type === 'healthcare_directive' && d.status === 'complete'
  );
  if (!hasCompleteHD) {
    flags.push({
      flag_id: nextId(),
      type: 'missing_healthcare_directive',
      severity: 'medium',
      message: 'No complete Healthcare Directive on file. Medical decisions may default to statutory priority if you become incapacitated.',
      related_asset_ids: [],
      related_doc_ids: [],
    });
  }

  // 7. business_transfer_unknown: Business asset with funding_status === 'unknown'
  const unknownBusinesses = assets.filter(
    a => a.type === 'business' && a.funding_status === 'unknown'
  );
  for (const a of unknownBusinesses) {
    flags.push({
      flag_id: nextId(),
      type: 'business_transfer_unknown',
      severity: 'high',
      message: `Business interest "${a.name}" has unknown funding status. The membership/ownership interest may not be assigned to the trust.`,
      related_asset_ids: [a.id],
      related_doc_ids: [],
    });
  }

  // 8. outdated_documents
  const outdatedDocs = documents.filter(d => d.status === 'outdated');
  for (const d of outdatedDocs) {
    flags.push({
      flag_id: nextId(),
      type: 'outdated_documents',
      severity: 'medium',
      message: `Document "${d.name}" is outdated and may no longer reflect current trust terms.`,
      related_asset_ids: [],
      related_doc_ids: [d.id],
    });
  }

  // 9. no_pour_over_will
  const hasPourOver = documents.some(
    d => d.doc_type === 'pour_over_will' && d.status === 'complete'
  );
  if (!hasPourOver) {
    flags.push({
      flag_id: nextId(),
      type: 'no_pour_over_will',
      severity: 'medium',
      message: 'No complete Pour-Over Will on file. Any assets not funded into the trust at death may pass through intestate succession instead of being caught by a pour-over provision.',
      related_asset_ids: [],
      related_doc_ids: [],
    });
  }

  return flags;
}

// ─── (h) Data Gap Detection ───────────────────────────────────────────────

function detectDataGaps(
  assets: AssetRow[],
  documents: DocumentRow[],
  trust: TrustProfile
): DataGap[] {
  const gaps: DataGap[] = [];
  let gapCounter = 0;

  const nextId = (): string => {
    gapCounter++;
    return `dg-${gapCounter.toString().padStart(4, '0')}`;
  };

  // 1. Asset without estimated_value
  for (const a of assets) {
    if (a.estimated_value === null || a.estimated_value === 0) {
      gaps.push({
        gap_id: nextId(),
        field: `assets[${a.id}].estimated_value`,
        message: `Asset "${a.name}" is missing an estimated value.`,
        resolution_hint: 'Enter the current estimated market value or account balance for this asset.',
      });
    }
  }

  // 2. Asset with funding_status 'unknown'
  for (const a of assets) {
    if (a.funding_status === 'unknown') {
      gaps.push({
        gap_id: nextId(),
        field: `assets[${a.id}].funding_status`,
        message: `Asset "${a.name}" has unknown funding status.`,
        resolution_hint: 'Check whether this asset has been retitled to the trust or has the trust as beneficiary. Update funding status to funded, unfunded, or partial.',
      });
    }
  }

  // 3. Trust without county
  if (!trust.county) {
    gaps.push({
      gap_id: nextId(),
      field: 'trust_profile.county',
      message: 'Trust profile is missing the county. County is needed to determine local recording requirements and probate thresholds.',
      resolution_hint: 'Enter the county where the trust was established or where the primary residence is located.',
    });
  }

  // 4. Missing beneficiary info on insurance/retirement accounts
  for (const a of assets) {
    if (
      (a.type === 'insurance' || a.type === 'retirement') &&
      !a.beneficiary_designation
    ) {
      gaps.push({
        gap_id: nextId(),
        field: `assets[${a.id}].beneficiary_designation`,
        message: `${a.type === 'insurance' ? 'Insurance' : 'Retirement'} account "${a.name}" is missing beneficiary designation information.`,
        resolution_hint: 'Contact the institution to obtain the current beneficiary designation form and enter who is currently named.',
      });
    }
  }

  // 5. Documents with 'needs_review' status
  for (const d of documents) {
    if (d.status === 'needs_review') {
      gaps.push({
        gap_id: nextId(),
        field: `documents[${d.id}].status`,
        message: `Document "${d.name}" needs review. Its current status may be inaccurate or it may need attorney attention.`,
        resolution_hint: 'Review this document with your estate planning attorney and update its status to complete or outdated.',
      });
    }
  }

  return gaps;
}

// ─── Utility Functions ─────────────────────────────────────────────────────

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a number with commas for display (no decimals for whole, 2 for fractions) */
function fmt(n: number): string {
  if (Number.isInteger(n)) {
    return n.toLocaleString('en-US');
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Normalize a name string for comparison (lowercase, trim, collapse whitespace) */
function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}
