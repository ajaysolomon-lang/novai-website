/**
 * AliveTrust — NBA (Next Best Action) Engine Unit Tests
 *
 * Tests for evaluateNBAs(), the deterministic Next Best Action engine.
 * The NBA engine takes compute results (red flags, data gaps, scores) and
 * a set of rules, then returns prioritized actions: top 3 + backlog.
 */

import { describe, it, expect } from 'vitest';
// Import the NBA engine function (to be implemented)
// import { evaluateNBAs } from '../api/src/nba/engine';
import type {
  ComputeResults,
  RedFlag,
  DataGap,
  NBARule,
  NBAAction,
} from '../api/src/types/index';

// ─── Placeholder until NBA engine is implemented ─────────────────────────────
// Once ../api/src/nba/engine.ts exports evaluateNBAs, replace this stub.

interface NBAInput {
  computeResults: ComputeResults;
  rules: NBARule[];
}

interface NBAOutput {
  top3: NBAAction[];
  backlog: NBAAction[];
}

// Stub: uncomment the real import and remove this when the engine exists
let evaluateNBAs: (input: NBAInput) => NBAOutput;

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeRedFlag(overrides: Partial<RedFlag> & Pick<RedFlag, 'type'>): RedFlag {
  return {
    flag_id: `rf-${Math.random().toString(36).slice(2, 6)}`,
    severity: 'high',
    message: `Red flag: ${overrides.type}`,
    related_asset_ids: [],
    related_doc_ids: [],
    ...overrides,
  };
}

function makeDataGap(overrides: Partial<DataGap>): DataGap {
  return {
    gap_id: `dg-${Math.random().toString(36).slice(2, 6)}`,
    field: 'assets[a1].funding_status',
    message: 'Asset has unknown funding status.',
    resolution_hint: 'Check whether asset is funded.',
    ...overrides,
  };
}

function makeRule(overrides: Partial<NBARule> & Pick<NBARule, 'rule_id'>): NBARule {
  return {
    condition_type: 'risk',
    condition_field: 'red_flags',
    condition_operator: 'contains',
    condition_value: 'unfunded_real_estate',
    action_type: 'fund_asset',
    action_title: 'Fund unfunded real estate',
    action_description: 'Transfer the property deed into the trust to avoid probate.',
    priority_base: 0.9,
    steps: [
      'Contact your estate planning attorney',
      'Prepare a new grant deed',
      'Record the deed with the county',
    ],
    evidence_required: ['recorded_deed', 'title_confirmation'],
    category: 'funding',
    enabled: true,
    ...overrides,
  };
}

function makeComputeResults(overrides: Partial<ComputeResults> = {}): ComputeResults {
  return {
    funding_coverage_value_pct: 70,
    funding_coverage_count_pct: 60,
    probate_exposure_amount: 500000,
    probate_exposure_assets: ['asset-002'],
    document_completeness_score: 65,
    incapacity_readiness_score: 70,
    evidence_completeness_pct: 50,
    red_flags: [],
    formulas: {
      funding_coverage_value: 'formula string',
      funding_coverage_count: 'formula string',
      probate_exposure: 'formula string',
      document_completeness: 'formula string',
      incapacity_readiness: 'formula string',
      evidence_completeness: 'formula string',
    },
    contributing_asset_ids: {
      funded_value: ['asset-001'],
      funded_count: ['asset-001'],
      probate_exposed: ['asset-002'],
      evidence_covered_assets: ['asset-001'],
    },
    contributing_evidence_ids: {
      asset_evidence: ['ev-001'],
      document_evidence: ['ev-002'],
    },
    data_gaps: [],
    ...overrides,
  };
}

// ─── (a) Rule Matching Tests ────────────────────────────────────────────────

describe('NBA Rule Matching', () => {
  // These tests validate that the NBA engine correctly matches rules
  // against compute results based on condition types.

  it.todo('should match a rule with "risk" trigger when corresponding red_flag exists');
  // When implemented:
  // const results = makeComputeResults({
  //   red_flags: [makeRedFlag({ type: 'unfunded_real_estate' })],
  // });
  // const rules = [
  //   makeRule({
  //     rule_id: 'r1',
  //     condition_type: 'risk',
  //     condition_field: 'red_flags',
  //     condition_operator: 'contains',
  //     condition_value: 'unfunded_real_estate',
  //   }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.length + output.backlog.length).toBe(1);
  // expect(output.top3[0]?.rule_id).toBe('r1');

  it.todo('should match a rule with "threshold" trigger when metric is below threshold');
  // const results = makeComputeResults({ funding_coverage_value_pct: 40 });
  // const rules = [
  //   makeRule({
  //     rule_id: 'r2',
  //     condition_type: 'threshold',
  //     condition_field: 'funding_coverage_value_pct',
  //     condition_operator: 'lt',
  //     condition_value: '50',
  //     action_title: 'Improve funding coverage',
  //   }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.some(a => a.rule_id === 'r2')).toBe(true);

  it.todo('should match a rule with "missing" trigger when field is null/empty');
  // const results = makeComputeResults({
  //   red_flags: [makeRedFlag({ type: 'missing_poa' })],
  // });
  // const rules = [
  //   makeRule({
  //     rule_id: 'r3',
  //     condition_type: 'missing',
  //     condition_field: 'financial_poa',
  //     condition_operator: 'equals',
  //     condition_value: 'true',
  //     action_title: 'Get missing POA',
  //   }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.some(a => a.rule_id === 'r3')).toBe(true);

  it.todo('should match a rule with "gap" trigger when data_gap exists');
  // const results = makeComputeResults({
  //   data_gaps: [makeDataGap({ field: 'assets[a1].funding_status' })],
  // });
  // const rules = [
  //   makeRule({
  //     rule_id: 'r4',
  //     condition_type: 'gap',
  //     condition_field: 'funding_status',
  //     condition_operator: 'exists',
  //     condition_value: 'true',
  //     action_title: 'Resolve funding status gap',
  //   }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.some(a => a.rule_id === 'r4')).toBe(true);

  it.todo('should exclude non-matching rules');
  // const results = makeComputeResults({ red_flags: [] }); // No red flags
  // const rules = [
  //   makeRule({
  //     rule_id: 'r5',
  //     condition_type: 'risk',
  //     condition_field: 'red_flags',
  //     condition_operator: 'contains',
  //     condition_value: 'unfunded_real_estate', // No such flag
  //   }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.length + output.backlog.length).toBe(0);

  it.todo('should not match disabled rules');
  // const results = makeComputeResults({
  //   red_flags: [makeRedFlag({ type: 'unfunded_real_estate' })],
  // });
  // const rules = [
  //   makeRule({ rule_id: 'r6', enabled: false }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3.length + output.backlog.length).toBe(0);
});

// ─── (b) Priority Scoring Tests ─────────────────────────────────────────────

describe('NBA Priority Scoring', () => {
  // Priority formula expected:
  // priority = (risk_reduction * 0.45) + (equity_protected * 0.35) + (time_score * 0.10) + (dependency_unlock * 0.10)

  it.todo('should compute priority using the weighted formula');
  // Given a rule with priority_base = 0.9 and known factor values,
  // the engine should produce a score matching the formula:
  // e.g., (0.9*0.45 + 0.8*0.35 + 0.5*0.10 + 0.7*0.10) = 0.405 + 0.28 + 0.05 + 0.07 = 0.805

  it.todo('should rank higher risk_reduction rules higher');
  // Two rules with different priority_base values:
  // Rule A: priority_base = 0.95 (critical risk)
  // Rule B: priority_base = 0.50 (low risk)
  // After evaluation, Rule A should have higher priority_score than Rule B

  it.todo('should produce specific score calculations with known weights');
  // Given exact input values, verify the exact numeric output.
  // This ensures the formula implementation matches the specification.
  // Example:
  //   risk_reduction=1.0, equity_protected=0.8, time_score=0.5, dependency_unlock=0.3
  //   expected = 1.0*0.45 + 0.8*0.35 + 0.5*0.10 + 0.3*0.10
  //            = 0.45 + 0.28 + 0.05 + 0.03
  //            = 0.81
});

// ─── (c) Top 3 / Backlog Split Tests ────────────────────────────────────────

describe('NBA Top 3 / Backlog Split', () => {
  it.todo('should put all actions in top3 when fewer than 3 matched rules');
  // const results = makeComputeResults({
  //   red_flags: [
  //     makeRedFlag({ type: 'unfunded_real_estate' }),
  //     makeRedFlag({ type: 'missing_poa' }),
  //   ],
  // });
  // const rules = [
  //   makeRule({ rule_id: 'r1', condition_value: 'unfunded_real_estate', priority_base: 0.9 }),
  //   makeRule({ rule_id: 'r2', condition_value: 'missing_poa', priority_base: 0.85,
  //     action_title: 'Get missing POA' }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3).toHaveLength(2);
  // expect(output.backlog).toHaveLength(0);

  it.todo('should put all actions in top3 when exactly 3 matched rules');
  // 3 matching rules -> 3 in top3, 0 in backlog

  it.todo('should put top 3 by priority in top3 and rest in backlog when more than 3');
  // 5 matching rules -> top 3 highest priority in top3, remaining 2 in backlog
  // const results = makeComputeResults({
  //   red_flags: [
  //     makeRedFlag({ type: 'unfunded_real_estate' }),
  //     makeRedFlag({ type: 'missing_poa' }),
  //     makeRedFlag({ type: 'beneficiary_mismatch' }),
  //     makeRedFlag({ type: 'business_transfer_unknown' }),
  //     makeRedFlag({ type: 'missing_healthcare_directive' }),
  //   ],
  // });
  // ... 5 rules with different priority_base values
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3).toHaveLength(3);
  // expect(output.backlog).toHaveLength(2);

  it.todo('should sort top3 by priority descending');
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3[0].priority_score).toBeGreaterThanOrEqual(output.top3[1].priority_score);
  // expect(output.top3[1].priority_score).toBeGreaterThanOrEqual(output.top3[2].priority_score);

  it.todo('should return empty top3 and backlog when no rules match');
  // const results = makeComputeResults({ red_flags: [], data_gaps: [] });
  // const rules = [
  //   makeRule({ rule_id: 'r1', condition_value: 'unfunded_real_estate' }),
  // ];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // expect(output.top3).toHaveLength(0);
  // expect(output.backlog).toHaveLength(0);
});

// ─── (d) Output Structure Tests ─────────────────────────────────────────────

describe('NBA Output Structure', () => {
  it.todo('should include all required fields on each NBAAction');
  // For each action in top3 and backlog, verify:
  // expect(action.action_id).toBeTruthy();
  // expect(action.rule_id).toBeTruthy();
  // expect(action.action_type).toBeTruthy();
  // expect(action.title).toBeTruthy();
  // expect(action.description).toBeTruthy();
  // expect(typeof action.priority_score).toBe('number');
  // expect(action.category).toBeTruthy();
  // expect(Array.isArray(action.steps)).toBe(true);
  // expect(Array.isArray(action.evidence_required)).toBe(true);
  // expect(Array.isArray(action.related_asset_ids)).toBe(true);
  // expect(Array.isArray(action.related_doc_ids)).toBe(true);

  it.todo('should have non-empty steps array on each action');
  // For each action:
  // expect(action.steps.length).toBeGreaterThan(0);
  // expect(action.steps.every((s: string) => typeof s === 'string' && s.length > 0)).toBe(true);

  it.todo('should have priority_score between 0 and 1');
  // For each action:
  // expect(action.priority_score).toBeGreaterThanOrEqual(0);
  // expect(action.priority_score).toBeLessThanOrEqual(1);

  it.todo('should include category from the matched rule');
  // const rules = [
  //   makeRule({ rule_id: 'r1', category: 'funding' }),
  // ];
  // action.category should be 'funding'

  it.todo('should include estimated_time_minutes when specified in rule');
  // Some actions may have an estimated time; verify it passes through

  it.todo('should include provider_type when specified in rule');
  // e.g., provider_type: 'attorney' for legal tasks
});

// ─── (e) Demo Dataset NBA Test ──────────────────────────────────────────────

describe('NBA Demo Dataset Integration', () => {
  // These tests verify that given the expected red flags from the demo dataset,
  // the NBA engine produces the correct high-priority actions.

  // Expected demo red flags:
  // - unfunded_real_estate (rental property)
  // - beneficiary_mismatch (insurance)
  // - business_transfer_unknown (LLC)
  // - missing_poa (no financial POA)

  const demoComputeResults = makeComputeResults({
    funding_coverage_value_pct: 73,
    funding_coverage_count_pct: 50,
    probate_exposure_amount: 803000,
    probate_exposure_assets: ['asset-002', 'asset-006', 'asset-007'],
    document_completeness_score: 70,
    incapacity_readiness_score: 70,
    evidence_completeness_pct: 42,
    red_flags: [
      makeRedFlag({
        type: 'unfunded_real_estate',
        severity: 'critical',
        message: 'Rental property is not funded into the trust.',
        related_asset_ids: ['asset-002'],
      }),
      makeRedFlag({
        type: 'deed_recording_gap',
        severity: 'high',
        message: 'Rental property has no complete recorded property deed.',
        related_asset_ids: ['asset-002'],
      }),
      makeRedFlag({
        type: 'beneficiary_mismatch',
        severity: 'high',
        message: 'Insurance beneficiary is Casey Rivera individually, not the trust.',
        related_asset_ids: ['asset-005'],
      }),
      makeRedFlag({
        type: 'business_transfer_unknown',
        severity: 'high',
        message: 'Rivera Design Studio LLC has unknown funding status.',
        related_asset_ids: ['asset-006'],
      }),
      makeRedFlag({
        type: 'missing_poa',
        severity: 'critical',
        message: 'No complete Financial Power of Attorney on file.',
      }),
    ],
    data_gaps: [
      makeDataGap({
        field: 'assets[asset-006].funding_status',
        message: 'LLC has unknown funding status.',
      }),
    ],
  });

  // Standard NBA rules that would be configured for the system
  const standardRules: NBARule[] = [
    makeRule({
      rule_id: 'nba-fund-real-estate',
      condition_type: 'risk',
      condition_field: 'red_flags',
      condition_operator: 'contains',
      condition_value: 'unfunded_real_estate',
      action_type: 'fund_asset',
      action_title: 'Fund unfunded real estate',
      action_description: 'Transfer property deed into the trust to eliminate probate exposure on this real estate asset.',
      priority_base: 0.95,
      steps: [
        'Contact your estate planning attorney',
        'Prepare a new grant deed transferring the property to the trust',
        'Have the deed notarized',
        'Record the deed with the county recorder',
        'Obtain title insurance endorsement',
        'Update homeowners insurance to reflect trust ownership',
      ],
      evidence_required: ['recorded_deed', 'title_insurance_endorsement'],
      category: 'funding',
    }),
    makeRule({
      rule_id: 'nba-fix-beneficiary',
      condition_type: 'risk',
      condition_field: 'red_flags',
      condition_operator: 'contains',
      condition_value: 'beneficiary_mismatch',
      action_type: 'update_beneficiary',
      action_title: 'Fix beneficiary mismatch',
      action_description: 'Update the beneficiary designation to match the intended beneficiary. Current designation does not align with trust distribution plan.',
      priority_base: 0.85,
      steps: [
        'Contact the insurance company or financial institution',
        'Request a change of beneficiary form',
        'Complete the form naming the trust as primary beneficiary',
        'Submit and obtain written confirmation',
      ],
      evidence_required: ['beneficiary_change_confirmation'],
      category: 'beneficiary',
    }),
    makeRule({
      rule_id: 'nba-get-poa',
      condition_type: 'risk',
      condition_field: 'red_flags',
      condition_operator: 'contains',
      condition_value: 'missing_poa',
      action_type: 'create_document',
      action_title: 'Get missing POA',
      action_description: 'Execute a Durable Financial Power of Attorney to ensure someone can manage finances during incapacity without court intervention.',
      priority_base: 0.90,
      steps: [
        'Consult with your estate planning attorney',
        'Draft a Durable Financial Power of Attorney',
        'Review and sign with proper witnessing and notarization',
        'Provide copies to financial institutions',
        'Store the original securely',
      ],
      evidence_required: ['signed_poa_scan', 'notarization_certificate'],
      category: 'incapacity_planning',
    }),
    makeRule({
      rule_id: 'nba-resolve-business',
      condition_type: 'risk',
      condition_field: 'red_flags',
      condition_operator: 'contains',
      condition_value: 'business_transfer_unknown',
      action_type: 'investigate_asset',
      action_title: 'Resolve business transfer status',
      action_description: 'Determine whether the LLC membership interest can be and has been transferred to the trust. Review the operating agreement for transfer restrictions.',
      priority_base: 0.75,
      steps: [
        'Review the LLC operating agreement for transfer restrictions',
        'Consult with your business attorney',
        'Obtain consent from other members if required',
        'Prepare an assignment of membership interest',
        'File any required amendments with the Secretary of State',
      ],
      evidence_required: ['operating_agreement_review', 'assignment_of_interest'],
      category: 'funding',
    }),
    makeRule({
      rule_id: 'nba-low-evidence',
      condition_type: 'threshold',
      condition_field: 'evidence_completeness_pct',
      condition_operator: 'lt',
      condition_value: '50',
      action_type: 'upload_evidence',
      action_title: 'Upload missing evidence documents',
      action_description: 'Several assets and documents lack uploaded evidence. Upload confirmation letters, statements, and recordings to strengthen the audit trail.',
      priority_base: 0.50,
      steps: [
        'Review list of assets and documents missing evidence',
        'Gather confirmation letters, statements, and recordings',
        'Upload each document and link to the corresponding asset or document',
        'Request verification for uploaded items',
      ],
      evidence_required: [],
      category: 'evidence',
    }),
  ];

  it.todo('should produce "Fund unfunded real estate" as a top-3 action');
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const fundAction = [...output.top3, ...output.backlog].find(
  //   a => a.rule_id === 'nba-fund-real-estate'
  // );
  // expect(fundAction).toBeDefined();
  // // With priority_base 0.95, this should be in top3
  // expect(output.top3.some(a => a.rule_id === 'nba-fund-real-estate')).toBe(true);

  it.todo('should produce "Fix beneficiary mismatch" action');
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const fixAction = [...output.top3, ...output.backlog].find(
  //   a => a.rule_id === 'nba-fix-beneficiary'
  // );
  // expect(fixAction).toBeDefined();

  it.todo('should produce "Get missing POA" action');
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const poaAction = [...output.top3, ...output.backlog].find(
  //   a => a.rule_id === 'nba-get-poa'
  // );
  // expect(poaAction).toBeDefined();

  it.todo('should include "Fund real estate", "Get POA", and "Fix beneficiary" in top 3');
  // These have the three highest priority_base values (0.95, 0.90, 0.85)
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const top3RuleIds = output.top3.map(a => a.rule_id);
  // expect(top3RuleIds).toContain('nba-fund-real-estate');
  // expect(top3RuleIds).toContain('nba-get-poa');
  // expect(top3RuleIds).toContain('nba-fix-beneficiary');

  it.todo('should put lower-priority actions in backlog');
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const backlogRuleIds = output.backlog.map(a => a.rule_id);
  // expect(backlogRuleIds).toContain('nba-resolve-business');
  // expect(backlogRuleIds).toContain('nba-low-evidence');

  it.todo('should produce deterministic output for demo data');
  // const output1 = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const output2 = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // expect(output1.top3.map(a => a.rule_id)).toEqual(output2.top3.map(a => a.rule_id));
  // expect(output1.backlog.map(a => a.rule_id)).toEqual(output2.backlog.map(a => a.rule_id));
});

// ─── (f) Edge Cases ─────────────────────────────────────────────────────────

describe('NBA Edge Cases', () => {
  it.todo('should handle empty rules array');
  // const output = evaluateNBAs({ computeResults: makeComputeResults(), rules: [] });
  // expect(output.top3).toHaveLength(0);
  // expect(output.backlog).toHaveLength(0);

  it.todo('should handle empty compute results (no flags, no gaps)');
  // const results = makeComputeResults({
  //   red_flags: [],
  //   data_gaps: [],
  //   funding_coverage_value_pct: 100,
  //   document_completeness_score: 100,
  //   incapacity_readiness_score: 100,
  //   evidence_completeness_pct: 100,
  // });
  // const rules = [makeRule({ rule_id: 'r1' })];
  // const output = evaluateNBAs({ computeResults: results, rules });
  // // Rules that check for flags won't match since there are none
  // expect(output.top3.length + output.backlog.length).toBe(0);

  it.todo('should handle duplicate matching rules gracefully');
  // Two rules that match the same red flag should both produce actions

  it.todo('should generate unique action_id for each NBAAction');
  // const output = evaluateNBAs({ computeResults: demoComputeResults, rules: standardRules });
  // const allIds = [...output.top3, ...output.backlog].map(a => a.action_id);
  // const uniqueIds = new Set(allIds);
  // expect(uniqueIds.size).toBe(allIds.length);
});
