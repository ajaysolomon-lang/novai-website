/**
 * AliveTrust — Next Best Action (NBA) Engine
 *
 * Pure function. No LLM calls. No randomness. No side effects.
 *
 * Evaluates a set of NBA rules against the latest ComputeResults to produce
 * a prioritized list of actions. The top 3 become "My Next 3 Moves" and
 * the rest go to the backlog.
 *
 * Priority formula:
 *   priority = (risk_reduction * 0.45) + (equity_protected * 0.35)
 *            + (time_score * 0.10) + (dependency_unlock * 0.10)
 */

import type { ComputeResults, TrustProfile } from '../types/index';
import type { NBAFullRule } from './rules';

// ─── Engine Output ─────────────────────────────────────────────────────────

export interface NBAAction {
  rule_id: string;
  name: string;
  description: string;
  priority_score: number;
  category: string;
  steps: string[];
  evidence_required: string[];
  done_definition: string;
  escalation_conditions: string[];
  owner_suggestion: string;
  estimated_complexity: string;
  estimated_time_minutes: number;
  /** Asset IDs from the red flags or data gaps that triggered this action */
  related_asset_ids: string[];
  /** Document IDs from the red flags that triggered this action */
  related_doc_ids: string[];
}

export interface NBAInput {
  computeResults: ComputeResults;
  trust: TrustProfile;
  rules: NBAFullRule[];
}

export interface NBAOutput {
  top3: NBAAction[];
  backlog: NBAAction[];
}

// ─── Priority Weight Constants ─────────────────────────────────────────────

const WEIGHT_RISK_REDUCTION = 0.45;
const WEIGHT_EQUITY_PROTECTED = 0.35;
const WEIGHT_TIME_SCORE = 0.10;
const WEIGHT_DEPENDENCY_UNLOCK = 0.10;

// ─── Main NBA Evaluation ───────────────────────────────────────────────────

export function evaluateNBAs(input: NBAInput): NBAOutput {
  const { computeResults, rules } = input;

  const matchedActions: NBAAction[] = [];

  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.enabled) continue;

    // Evaluate trigger condition
    const triggerResult = evaluateTrigger(rule, computeResults);

    if (!triggerResult.triggered) continue;

    // Calculate priority score
    const priorityScore = calculatePriority(rule);

    // Build the action
    const action: NBAAction = {
      rule_id: rule.rule_id,
      name: rule.name,
      description: rule.description,
      priority_score: round2(priorityScore),
      category: rule.category,
      steps: rule.steps,
      evidence_required: rule.evidence_required,
      done_definition: rule.done_definition,
      escalation_conditions: rule.escalation_conditions,
      owner_suggestion: rule.owner_suggestion,
      estimated_complexity: rule.estimated_complexity,
      estimated_time_minutes: rule.estimated_time_minutes,
      related_asset_ids: triggerResult.relatedAssetIds,
      related_doc_ids: triggerResult.relatedDocIds,
    };

    matchedActions.push(action);
  }

  // Sort by priority descending (highest priority first)
  matchedActions.sort((a, b) => b.priority_score - a.priority_score);

  // Top 3 become "My Next 3 Moves", rest become backlog
  const top3 = matchedActions.slice(0, 3);
  const backlog = matchedActions.slice(3);

  return { top3, backlog };
}

// ─── Trigger Evaluation ────────────────────────────────────────────────────

interface TriggerResult {
  triggered: boolean;
  relatedAssetIds: string[];
  relatedDocIds: string[];
}

function evaluateTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  const noMatch: TriggerResult = { triggered: false, relatedAssetIds: [], relatedDocIds: [] };

  switch (rule.trigger_type) {
    case 'risk':
      return evaluateRiskTrigger(rule, results);

    case 'gap':
      return evaluateGapTrigger(rule, results);

    case 'threshold':
      return evaluateThresholdTrigger(rule, results);

    case 'missing':
      return evaluateMissingTrigger(rule, results);

    case 'conflict':
      return evaluateConflictTrigger(rule, results);

    default:
      return noMatch;
  }
}

/**
 * 'risk' trigger: Check if a specific red_flag type exists in computeResults.
 */
function evaluateRiskTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  const matchingFlags = results.red_flags.filter(f => f.type === rule.trigger_field);

  if (matchingFlags.length === 0) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  // Collect all related IDs from matching flags
  const relatedAssetIds: string[] = [];
  const relatedDocIds: string[] = [];

  for (const flag of matchingFlags) {
    relatedAssetIds.push(...flag.related_asset_ids);
    relatedDocIds.push(...flag.related_doc_ids);
  }

  return {
    triggered: true,
    relatedAssetIds: dedupe(relatedAssetIds),
    relatedDocIds: dedupe(relatedDocIds),
  };
}

/**
 * 'gap' trigger: Check if a specific data_gap field pattern exists.
 * The trigger_field is matched as a substring against gap.field values.
 */
function evaluateGapTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  const matchingGaps = results.data_gaps.filter(g =>
    g.field.includes(rule.trigger_field)
  );

  if (matchingGaps.length === 0) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  // Extract asset IDs from gap fields like "assets[<id>].field"
  const relatedAssetIds: string[] = [];
  const relatedDocIds: string[] = [];

  for (const gap of matchingGaps) {
    const assetMatch = gap.field.match(/^assets\[([^\]]+)\]/);
    if (assetMatch) {
      relatedAssetIds.push(assetMatch[1]);
    }

    const docMatch = gap.field.match(/^documents\[([^\]]+)\]/);
    if (docMatch) {
      relatedDocIds.push(docMatch[1]);
    }
  }

  return {
    triggered: true,
    relatedAssetIds: dedupe(relatedAssetIds),
    relatedDocIds: dedupe(relatedDocIds),
  };
}

/**
 * 'threshold' trigger: Check if a metric is above or below a threshold.
 * The trigger_field is the key in ComputeResults (a numeric field).
 * The trigger_operator is 'lt' or 'gt'.
 * The trigger_value is the numeric threshold.
 */
function evaluateThresholdTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  const metricValue = getMetricValue(results, rule.trigger_field);

  if (metricValue === null) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  const threshold = parseFloat(rule.trigger_value);
  if (isNaN(threshold)) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  let triggered = false;
  if (rule.trigger_operator === 'lt') {
    triggered = metricValue < threshold;
  } else if (rule.trigger_operator === 'gt') {
    triggered = metricValue > threshold;
  } else if (rule.trigger_operator === 'eq') {
    triggered = metricValue === threshold;
  }

  if (!triggered) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  // For threshold triggers, gather related IDs from the contributing_asset_ids
  // that are relevant to this metric
  const relatedAssetIds: string[] = [];
  if (rule.trigger_field === 'funding_coverage_value_pct') {
    // The probate-exposed assets are the ones that need attention
    relatedAssetIds.push(...(results.probate_exposure_assets || []));
  }

  return {
    triggered: true,
    relatedAssetIds: dedupe(relatedAssetIds),
    relatedDocIds: [],
  };
}

/**
 * 'missing' trigger: Check if a field is null/empty in the trust profile or results.
 * Used for top-level missing data (not per-asset gaps).
 */
function evaluateMissingTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  // Check in data_gaps for the specified field
  const hasGap = results.data_gaps.some(g => g.field === rule.trigger_field);

  return {
    triggered: hasGap,
    relatedAssetIds: [],
    relatedDocIds: [],
  };
}

/**
 * 'conflict' trigger: Check if beneficiary_mismatch red flag exists.
 */
function evaluateConflictTrigger(rule: NBAFullRule, results: ComputeResults): TriggerResult {
  // Conflict triggers look for the beneficiary_mismatch flag (or the specified trigger_field)
  const matchingFlags = results.red_flags.filter(f => f.type === rule.trigger_field);

  if (matchingFlags.length === 0) {
    return { triggered: false, relatedAssetIds: [], relatedDocIds: [] };
  }

  const relatedAssetIds: string[] = [];
  const relatedDocIds: string[] = [];

  for (const flag of matchingFlags) {
    relatedAssetIds.push(...flag.related_asset_ids);
    relatedDocIds.push(...flag.related_doc_ids);
  }

  return {
    triggered: true,
    relatedAssetIds: dedupe(relatedAssetIds),
    relatedDocIds: dedupe(relatedDocIds),
  };
}

// ─── Priority Calculation ──────────────────────────────────────────────────

function calculatePriority(rule: NBAFullRule): number {
  return (
    rule.risk_reduction * WEIGHT_RISK_REDUCTION +
    rule.equity_protected * WEIGHT_EQUITY_PROTECTED +
    rule.time_score * WEIGHT_TIME_SCORE +
    rule.dependency_unlock * WEIGHT_DEPENDENCY_UNLOCK
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Look up a numeric metric value from ComputeResults by field name */
function getMetricValue(results: ComputeResults, field: string): number | null {
  switch (field) {
    case 'funding_coverage_value_pct':
      return results.funding_coverage_value_pct;
    case 'funding_coverage_count_pct':
      return results.funding_coverage_count_pct;
    case 'probate_exposure_amount':
      return results.probate_exposure_amount;
    case 'document_completeness_score':
      return results.document_completeness_score;
    case 'incapacity_readiness_score':
      return results.incapacity_readiness_score;
    case 'evidence_completeness_pct':
      return results.evidence_completeness_pct;
    default:
      return null;
  }
}

/** Remove duplicate strings from an array */
function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
