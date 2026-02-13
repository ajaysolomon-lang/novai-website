/**
 * AliveTrust — Demo Dataset Stability Tests
 *
 * These tests ensure that the scoring engine produces stable, explainable
 * output from the demo dataset. They serve as a regression guard: if the
 * engine's logic changes, these tests will catch unexpected shifts in
 * scores, formulas, flags, and gaps.
 *
 * The demo dataset is hardcoded here (matching seed/demo_dataset.json)
 * rather than imported, so the tests are self-contained and portable.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTrustHealth,
  type ComputeInput,
  type AssetRow,
  type DocumentRow,
  type EvidenceRow,
} from '../api/src/compute/engine';
import type { TrustProfile, ComputeResults } from '../api/src/types/index';

// ─── Demo Dataset (hardcoded from seed/demo_dataset.json) ────────────────────

const demoTrust: TrustProfile = {
  id: 'trust-demo-001',
  user_id: 'demo-user-001',
  trust_name: 'Rivera Family Living Trust',
  trust_type: 'revocable',
  jurisdiction: 'CA',
  date_established: '2021-03-15',
  grantor_names: ['Jordan Rivera', 'Casey Rivera'],
  trustee_names: ['Jordan Rivera', 'Casey Rivera'],
  successor_trustee_names: ['Alex Rivera', 'Pacific Trust Company'],
  beneficiary_names: ['Alex Rivera', 'Morgan Rivera', 'Riverside Community Foundation'],
  estimated_estate_value: 3190000,
  has_pour_over_will: true,
  has_power_of_attorney: false,
  has_healthcare_directive: true,
  status: 'active',
  created_at: '2024-06-01T10:00:00Z',
  updated_at: '2024-06-01T10:00:00Z',
  county: 'Los Angeles',
} as TrustProfile;

const demoAssets: AssetRow[] = [
  {
    id: 'asset-001', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Primary Residence - 742 Elm Street, Pasadena, CA 91101',
    type: 'real_estate', subtype: 'primary_residence',
    estimated_value: 1250000, funding_status: 'funded',
    funding_method: 'grant_deed_recorded',
    beneficiary_designation: null, intended_beneficiary: null,
    location_address: '742 Elm Street, Pasadena, CA 91101',
    account_number_last4: null, institution: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-002', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Rental Property - 1580 Ocean Blvd, Unit 4B, Long Beach, CA 90802',
    type: 'real_estate', subtype: 'rental_property',
    estimated_value: 485000, funding_status: 'unfunded',
    funding_method: null,
    beneficiary_designation: null, intended_beneficiary: null,
    location_address: '1580 Ocean Blvd, Unit 4B, Long Beach, CA 90802',
    account_number_last4: null, institution: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-003', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Joint Checking Account - First Republic Bank',
    type: 'financial', subtype: 'checking_account',
    estimated_value: 42000, funding_status: 'funded',
    funding_method: 'account_retitled',
    beneficiary_designation: null, intended_beneficiary: null,
    location_address: null,
    account_number_last4: '8834', institution: 'First Republic Bank', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-004', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Brokerage Account - Charles Schwab',
    type: 'financial', subtype: 'brokerage_account',
    estimated_value: 315000, funding_status: 'funded',
    funding_method: 'account_retitled',
    beneficiary_designation: 'trust', intended_beneficiary: null,
    location_address: null,
    account_number_last4: '2291', institution: 'Charles Schwab', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-005', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Term Life Insurance - Northwestern Mutual',
    type: 'insurance', subtype: 'term_life',
    estimated_value: 500000, funding_status: 'funded',
    funding_method: 'ownership_transferred',
    beneficiary_designation: 'Casey Rivera (individual)',
    intended_beneficiary: 'Rivera Family Living Trust',
    location_address: null,
    account_number_last4: '7712', institution: 'Northwestern Mutual', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-006', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Rivera Design Studio LLC - 60% Membership Interest',
    type: 'business', subtype: 'llc_membership',
    estimated_value: 280000, funding_status: 'unknown',
    funding_method: null,
    beneficiary_designation: null, intended_beneficiary: null,
    location_address: null,
    account_number_last4: null, institution: 'California Secretary of State', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-007', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: '2022 Tesla Model Y - VIN ending 9847',
    type: 'personal_property', subtype: 'vehicle',
    estimated_value: 38000, funding_status: 'unfunded',
    funding_method: null,
    beneficiary_designation: null, intended_beneficiary: null,
    location_address: null,
    account_number_last4: null, institution: 'California DMV', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-008', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Traditional IRA - Fidelity Investments',
    type: 'retirement', subtype: 'traditional_ira',
    estimated_value: 195000, funding_status: 'funded',
    funding_method: 'beneficiary_designation',
    beneficiary_designation: 'Casey Rivera (primary); Alex Rivera (contingent); Morgan Rivera (contingent)',
    intended_beneficiary: null,
    location_address: null,
    account_number_last4: '6103', institution: 'Fidelity Investments', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'asset-009', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Savings Account - Ally Bank',
    type: 'financial', subtype: 'savings_account',
    estimated_value: 85000, funding_status: 'funded',
    funding_method: 'pod_designation',
    beneficiary_designation: 'trust', intended_beneficiary: null,
    location_address: null,
    account_number_last4: '5520', institution: 'Ally Bank', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
];

const demoDocuments: DocumentRow[] = [
  {
    id: 'doc-001', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Rivera Family Living Trust Agreement',
    doc_type: 'trust_document', status: 'complete',
    date_signed: '2021-03-15', date_expires: null,
    required: 1, weight: 25, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-002', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Pour-Over Will - Jordan Rivera',
    doc_type: 'pour_over_will', status: 'complete',
    date_signed: '2021-03-15', date_expires: null,
    required: 1, weight: 15, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-003', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Durable Financial Power of Attorney - Jordan Rivera',
    doc_type: 'financial_poa', status: 'missing',
    date_signed: null, date_expires: null,
    required: 1, weight: 15, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-004', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Advance Healthcare Directive - Jordan Rivera',
    doc_type: 'healthcare_directive', status: 'complete',
    date_signed: '2021-03-15', date_expires: null,
    required: 1, weight: 10, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-005', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Advance Healthcare Directive - Casey Rivera',
    doc_type: 'healthcare_directive', status: 'complete',
    date_signed: '2021-03-15', date_expires: null,
    required: 1, weight: 10, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-006', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Certificate of Trust',
    doc_type: 'certificate_of_trust', status: 'complete',
    date_signed: '2021-03-20', date_expires: null,
    required: 1, weight: 5, linked_asset_id: null, notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-007', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Grant Deed - 742 Elm Street, Pasadena (Primary Residence)',
    doc_type: 'property_deed', status: 'complete',
    date_signed: '2021-04-15', date_expires: null,
    required: 1, weight: 10, linked_asset_id: 'asset-001', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
  {
    id: 'doc-008', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    name: 'Grant Deed - 1580 Ocean Blvd, Unit 4B, Long Beach (Rental Property)',
    doc_type: 'property_deed', status: 'missing',
    date_signed: null, date_expires: null,
    required: 1, weight: 10, linked_asset_id: 'asset-002', notes: null,
    created_at: '2024-06-01', updated_at: '2024-06-01',
  },
];

const demoEvidence: EvidenceRow[] = [
  {
    id: 'ev-001', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: null, linked_doc_id: 'doc-001',
    type: 'scan', file_name: 'rivera_trust_agreement_signed_2021-03-15.pdf',
    file_key: 'uploads/ev-001.pdf', mime_type: 'application/pdf', file_size: 4300800,
    uploaded_at: '2024-06-15T14:30:00Z',
    verified: 1, verified_by: 'system_ocr', verified_at: '2024-06-15T14:35:00Z',
    notes: null,
  },
  {
    id: 'ev-002', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: 'asset-001', linked_doc_id: null,
    type: 'recording', file_name: 'deed_recording_confirmation_742elm_2021-04-15.pdf',
    file_key: 'uploads/ev-002.pdf', mime_type: 'application/pdf', file_size: 870400,
    uploaded_at: '2024-06-15T14:45:00Z',
    verified: 1, verified_by: 'system_ocr', verified_at: '2024-06-15T14:50:00Z',
    notes: null,
  },
  {
    id: 'ev-003', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: 'asset-003', linked_doc_id: null,
    type: 'letter', file_name: 'first_republic_title_change_confirmation.pdf',
    file_key: 'uploads/ev-003.pdf', mime_type: 'application/pdf', file_size: 327680,
    uploaded_at: '2024-06-20T09:15:00Z',
    verified: 1, verified_by: 'manual_review', verified_at: '2024-06-20T09:20:00Z',
    notes: null,
  },
  {
    id: 'ev-004', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: 'asset-004', linked_doc_id: null,
    type: 'form', file_name: 'schwab_account_retitle_confirmation.pdf',
    file_key: 'uploads/ev-004.pdf', mime_type: 'application/pdf', file_size: 491520,
    uploaded_at: '2024-06-20T09:30:00Z',
    verified: 1, verified_by: 'manual_review', verified_at: '2024-06-20T09:35:00Z',
    notes: null,
  },
  {
    id: 'ev-005', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: 'asset-006', linked_doc_id: null,
    type: 'form', file_name: 'rivera_design_studio_llc_operating_agreement.pdf',
    file_key: 'uploads/ev-005.pdf', mime_type: 'application/pdf', file_size: 1843200,
    uploaded_at: '2024-07-01T11:00:00Z',
    verified: 0, verified_by: null, verified_at: null,
    notes: null,
  },
  {
    id: 'ev-006', trust_id: 'trust-demo-001', user_id: 'demo-user-001',
    linked_asset_id: null, linked_doc_id: 'doc-007',
    type: 'scan', file_name: 'recorded_deed_742elm_certified_copy.pdf',
    file_key: 'uploads/ev-006.pdf', mime_type: 'application/pdf', file_size: 1126400,
    uploaded_at: '2024-07-10T16:00:00Z',
    verified: 1, verified_by: 'system_ocr', verified_at: '2024-07-10T16:05:00Z',
    notes: null,
  },
];

const demoInput: ComputeInput = {
  trust: demoTrust,
  assets: demoAssets,
  documents: demoDocuments,
  evidence: demoEvidence,
};

// ─── Stability Tests ────────────────────────────────────────────────────────

describe('Demo Dataset Stability', () => {
  it('should produce stable, explainable output from demo dataset', () => {
    const result = computeTrustHealth(demoInput);

    // All numeric scores should be defined numbers
    expect(typeof result.funding_coverage_value_pct).toBe('number');
    expect(typeof result.funding_coverage_count_pct).toBe('number');
    expect(typeof result.probate_exposure_amount).toBe('number');
    expect(typeof result.document_completeness_score).toBe('number');
    expect(typeof result.incapacity_readiness_score).toBe('number');
    expect(typeof result.evidence_completeness_pct).toBe('number');

    // Scores should be in valid ranges
    expect(result.funding_coverage_value_pct).toBeGreaterThanOrEqual(0);
    expect(result.funding_coverage_value_pct).toBeLessThanOrEqual(100);

    expect(result.funding_coverage_count_pct).toBeGreaterThanOrEqual(0);
    expect(result.funding_coverage_count_pct).toBeLessThanOrEqual(100);

    expect(result.probate_exposure_amount).toBeGreaterThanOrEqual(0);

    expect(result.document_completeness_score).toBeGreaterThanOrEqual(0);
    expect(result.document_completeness_score).toBeLessThanOrEqual(100);

    expect(result.incapacity_readiness_score).toBeGreaterThanOrEqual(0);
    expect(result.incapacity_readiness_score).toBeLessThanOrEqual(100);

    expect(result.evidence_completeness_pct).toBeGreaterThanOrEqual(0);
    expect(result.evidence_completeness_pct).toBeLessThanOrEqual(100);

    // Red flags should be present and explained
    expect(result.red_flags.length).toBeGreaterThan(0);
    for (const flag of result.red_flags) {
      expect(flag.flag_id).toBeTruthy();
      expect(flag.type).toBeTruthy();
      expect(flag.severity).toBeTruthy();
      expect(flag.message).toBeTruthy();
      expect(flag.message.length).toBeGreaterThan(10);
    }

    // Data gaps should be flagged
    expect(result.data_gaps.length).toBeGreaterThan(0);
    for (const gap of result.data_gaps) {
      expect(gap.gap_id).toBeTruthy();
      expect(gap.field).toBeTruthy();
      expect(gap.message).toBeTruthy();
      expect(gap.resolution_hint).toBeTruthy();
    }
  });

  it('should produce identical results across multiple runs (snapshot stability)', () => {
    const run1 = computeTrustHealth(demoInput);
    const run2 = computeTrustHealth(demoInput);
    const run3 = computeTrustHealth(demoInput);

    // All numeric values should be byte-identical across runs
    expect(run1.funding_coverage_value_pct).toBe(run2.funding_coverage_value_pct);
    expect(run2.funding_coverage_value_pct).toBe(run3.funding_coverage_value_pct);

    expect(run1.funding_coverage_count_pct).toBe(run2.funding_coverage_count_pct);
    expect(run2.funding_coverage_count_pct).toBe(run3.funding_coverage_count_pct);

    expect(run1.probate_exposure_amount).toBe(run2.probate_exposure_amount);
    expect(run2.probate_exposure_amount).toBe(run3.probate_exposure_amount);

    expect(run1.document_completeness_score).toBe(run2.document_completeness_score);
    expect(run2.document_completeness_score).toBe(run3.document_completeness_score);

    expect(run1.incapacity_readiness_score).toBe(run2.incapacity_readiness_score);
    expect(run2.incapacity_readiness_score).toBe(run3.incapacity_readiness_score);

    expect(run1.evidence_completeness_pct).toBe(run2.evidence_completeness_pct);
    expect(run2.evidence_completeness_pct).toBe(run3.evidence_completeness_pct);

    // Red flag count and types should be identical
    expect(run1.red_flags.length).toBe(run2.red_flags.length);
    expect(run2.red_flags.length).toBe(run3.red_flags.length);

    const types1 = run1.red_flags.map(f => f.type).sort();
    const types2 = run2.red_flags.map(f => f.type).sort();
    const types3 = run3.red_flags.map(f => f.type).sort();
    expect(types1).toEqual(types2);
    expect(types2).toEqual(types3);

    // Data gap count should be identical
    expect(run1.data_gaps.length).toBe(run2.data_gaps.length);
    expect(run2.data_gaps.length).toBe(run3.data_gaps.length);

    // Formula strings should be identical
    expect(run1.formulas).toEqual(run2.formulas);
    expect(run2.formulas).toEqual(run3.formulas);

    // Contributing IDs should be identical
    expect(run1.contributing_asset_ids).toEqual(run2.contributing_asset_ids);
    expect(run2.contributing_asset_ids).toEqual(run3.contributing_asset_ids);

    expect(run1.contributing_evidence_ids).toEqual(run2.contributing_evidence_ids);
    expect(run2.contributing_evidence_ids).toEqual(run3.contributing_evidence_ids);
  });

  it('should include formula strings for all metrics', () => {
    const result = computeTrustHealth(demoInput);

    // Every formula key should exist and be a non-empty string
    expect(result.formulas.funding_coverage_value).toBeTruthy();
    expect(typeof result.formulas.funding_coverage_value).toBe('string');

    expect(result.formulas.funding_coverage_count).toBeTruthy();
    expect(typeof result.formulas.funding_coverage_count).toBe('string');

    expect(result.formulas.probate_exposure).toBeTruthy();
    expect(typeof result.formulas.probate_exposure).toBe('string');

    expect(result.formulas.document_completeness).toBeTruthy();
    expect(typeof result.formulas.document_completeness).toBe('string');

    expect(result.formulas.incapacity_readiness).toBeTruthy();
    expect(typeof result.formulas.incapacity_readiness).toBe('string');

    expect(result.formulas.evidence_completeness).toBeTruthy();
    expect(typeof result.formulas.evidence_completeness).toBe('string');

    // Formulas should contain numeric content (dollar signs, percentages, counts)
    expect(result.formulas.funding_coverage_value).toMatch(/\d/);
    expect(result.formulas.probate_exposure).toMatch(/\$/);
    expect(result.formulas.document_completeness).toMatch(/%/);
    expect(result.formulas.incapacity_readiness).toMatch(/\d/);
  });

  it('should include contributing IDs for all metrics', () => {
    const result = computeTrustHealth(demoInput);

    // Contributing asset IDs
    expect(result.contributing_asset_ids).toBeDefined();
    expect(result.contributing_asset_ids.funded_value).toBeDefined();
    expect(result.contributing_asset_ids.funded_value.length).toBeGreaterThan(0);

    expect(result.contributing_asset_ids.funded_count).toBeDefined();
    expect(result.contributing_asset_ids.funded_count.length).toBeGreaterThan(0);

    expect(result.contributing_asset_ids.probate_exposed).toBeDefined();
    expect(result.contributing_asset_ids.probate_exposed.length).toBeGreaterThan(0);

    expect(result.contributing_asset_ids.evidence_covered_assets).toBeDefined();
    expect(result.contributing_asset_ids.evidence_covered_assets.length).toBeGreaterThan(0);

    // Contributing evidence IDs
    expect(result.contributing_evidence_ids).toBeDefined();
    expect(result.contributing_evidence_ids.asset_evidence).toBeDefined();
    expect(result.contributing_evidence_ids.asset_evidence.length).toBeGreaterThan(0);

    expect(result.contributing_evidence_ids.document_evidence).toBeDefined();
    expect(result.contributing_evidence_ids.document_evidence.length).toBeGreaterThan(0);
  });

  it('should detect all known red flags from demo dataset', () => {
    const result = computeTrustHealth(demoInput);
    const flagTypes = result.red_flags.map(f => f.type);

    // These four are explicitly expected per the demo dataset spec
    expect(flagTypes).toContain('unfunded_real_estate');
    expect(flagTypes).toContain('beneficiary_mismatch');
    expect(flagTypes).toContain('business_transfer_unknown');
    expect(flagTypes).toContain('missing_poa');

    // Additionally, the engine should detect these based on the data
    expect(flagTypes).toContain('deed_recording_gap'); // rental has no deed
  });

  it('should detect data gaps for unknown funding status', () => {
    const result = computeTrustHealth(demoInput);

    const llcGap = result.data_gaps.find(
      g => g.field.includes('asset-006') && g.field.includes('funding_status')
    );
    expect(llcGap).toBeDefined();
    expect(llcGap!.message).toContain('unknown funding status');
  });

  it('should have valid probate exposure asset references', () => {
    const result = computeTrustHealth(demoInput);

    // Every asset ID in probate_exposure_assets should be a real asset ID
    const assetIds = new Set(demoAssets.map(a => a.id));
    for (const id of result.probate_exposure_assets) {
      expect(assetIds.has(id)).toBe(true);
    }
  });

  it('should have valid contributing asset ID references', () => {
    const result = computeTrustHealth(demoInput);

    const assetIds = new Set(demoAssets.map(a => a.id));

    for (const id of result.contributing_asset_ids.funded_value) {
      expect(assetIds.has(id)).toBe(true);
    }
    for (const id of result.contributing_asset_ids.funded_count) {
      expect(assetIds.has(id)).toBe(true);
    }
    for (const id of result.contributing_asset_ids.probate_exposed) {
      expect(assetIds.has(id)).toBe(true);
    }
    for (const id of result.contributing_asset_ids.evidence_covered_assets) {
      expect(assetIds.has(id)).toBe(true);
    }
  });

  it('should have valid contributing evidence ID references', () => {
    const result = computeTrustHealth(demoInput);

    const evidenceIds = new Set(demoEvidence.map(e => e.id));

    for (const id of result.contributing_evidence_ids.asset_evidence) {
      expect(evidenceIds.has(id)).toBe(true);
    }
    for (const id of result.contributing_evidence_ids.document_evidence) {
      expect(evidenceIds.has(id)).toBe(true);
    }
  });

  it('should have red flag IDs that are unique', () => {
    const result = computeTrustHealth(demoInput);

    const flagIds = result.red_flags.map(f => f.flag_id);
    const uniqueIds = new Set(flagIds);
    expect(uniqueIds.size).toBe(flagIds.length);
  });

  it('should have data gap IDs that are unique', () => {
    const result = computeTrustHealth(demoInput);

    const gapIds = result.data_gaps.map(g => g.gap_id);
    const uniqueIds = new Set(gapIds);
    expect(uniqueIds.size).toBe(gapIds.length);
  });

  it('should match expected score ranges from demo_dataset.json', () => {
    const result = computeTrustHealth(demoInput);

    // These ranges come from expected_computed_scores in demo_dataset.json
    // funding_coverage_value_pct: ~72%
    expect(result.funding_coverage_value_pct).toBeGreaterThanOrEqual(65);
    expect(result.funding_coverage_value_pct).toBeLessThanOrEqual(80);

    // funding_coverage_count_pct: ~50%
    expect(result.funding_coverage_count_pct).toBeGreaterThanOrEqual(40);
    expect(result.funding_coverage_count_pct).toBeLessThanOrEqual(75);

    // document_completeness: ~71%
    expect(result.document_completeness_score).toBeGreaterThanOrEqual(60);
    expect(result.document_completeness_score).toBeLessThanOrEqual(80);

    // incapacity_readiness: ~67-70%
    expect(result.incapacity_readiness_score).toBeGreaterThanOrEqual(60);
    expect(result.incapacity_readiness_score).toBeLessThanOrEqual(75);
  });
});
