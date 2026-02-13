// ─── Environment Bindings ───────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ALLOWED_ORIGIN: string;
}

// ─── Session ────────────────────────────────────────────────────────────────

export interface SessionData {
  user_id: string;
  email: string;
  created_at: string;
  expires_at: string;
}

// ─── API Response ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  citations?: Citation[];
}

export interface Citation {
  chunk_id?: string;
  source_id?: string;
  text_snippet?: string;
}

// ─── User ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone?: string | null;
  role?: 'owner' | 'trustee' | 'advisor' | 'admin';
  created_at: string;
  updated_at: string;
  last_login: string | null;
  status: 'active' | 'inactive' | 'suspended';
}

// ─── Trust Profile ──────────────────────────────────────────────────────────

export interface TrustProfile {
  id: string;
  user_id: string;
  trust_name: string;
  trust_type: 'revocable' | 'irrevocable' | 'joint' | 'special_needs' | 'charitable';
  jurisdiction: string;
  county?: string | null;
  date_established: string | null;
  date_last_amended?: string | null;
  grantor_names: string[];
  trustee_names: string[];
  successor_trustee_names: string[];
  beneficiary_names: string[];
  ein?: string;
  estimated_estate_value: number | null;
  has_pour_over_will: boolean;
  has_power_of_attorney: boolean;
  has_healthcare_directive: boolean;
  notes?: string | null;
  status: 'draft' | 'active' | 'under_review' | 'needs_update';
  created_at: string;
  updated_at: string;
}

// ─── Asset ──────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  trust_id: string;
  asset_type: string;
  name: string;
  description?: string | null;
  estimated_value?: number | null;
  institution?: string | null;
  account_number?: string | null;
  account_number_last4?: string | null;
  address?: string | null;
  funding_status?: 'funded' | 'unfunded' | 'partial' | 'unknown';
  funding_method?: string | null;
  funding_date?: string | null;
  beneficiary_designation?: string | null;
  intended_beneficiary?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Document ───────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  trust_id: string;
  document_type: string;
  doc_type?: string;
  title: string;
  description?: string | null;
  file_key?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_url?: string | null;
  file_hash?: string | null;
  mime_type?: string | null;
  page_count?: number | null;
  date_signed?: string | null;
  date_notarized?: string | null;
  date_expires?: string | null;
  expiration_date?: string | null;
  status: string;
  required?: number;
  weight?: number;
  linked_asset_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Evidence ───────────────────────────────────────────────────────────────

export interface Evidence {
  id: string;
  trust_id: string;
  evidence_type: string;
  title?: string;
  description?: string | null;
  linked_asset_id?: string | null;
  linked_doc_id?: string | null;
  related_asset_id?: string | null;
  related_doc_id?: string | null;
  file_key?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_url?: string | null;
  file_hash?: string | null;
  mime_type?: string | null;
  verified?: boolean | number;
  verified_at?: string | null;
  verified_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

// ─── Document Chunks (RAG) ──────────────────────────────────────────────────

export interface DocChunk {
  id: string;
  doc_id: string;
  trust_id: string;
  chunk_index: number;
  content: string;
  embedding_vector: string | null;
  token_count: number | null;
  source_page: number | null;
  created_at: string;
}

// ─── Computation ────────────────────────────────────────────────────────────

export interface Computation {
  id: string;
  trust_id: string;
  computed_at: string;
  trust_health_score: number;
  funding_coverage_pct: number;
  probate_exposure: number;
  document_completeness_pct: number;
  incapacity_readiness_pct: number;
  results: ComputeResults;
  version: number;
}

// ─── Compute Results (Full Output) ──────────────────────────────────────────

export interface ComputeResults {
  funding_coverage_value_pct: number;
  funding_coverage_count_pct: number;
  probate_exposure_amount: number;
  probate_exposure_assets: string[];
  document_completeness_score: number;
  incapacity_readiness_score: number;
  evidence_completeness_pct: number;
  red_flags: RedFlag[];
  formulas: Record<string, string>;
  contributing_asset_ids: Record<string, string[]>;
  contributing_evidence_ids: Record<string, string[]>;
  data_gaps: DataGap[];
}

export interface RedFlag {
  flag_id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  related_asset_ids: string[];
  related_doc_ids: string[];
}

export interface DataGap {
  gap_id: string;
  field: string;
  message: string;
  resolution_hint: string;
}

// ─── Next Best Action (NBA) ─────────────────────────────────────────────────

export interface NBARule {
  rule_id: string;
  condition_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  action_title: string;
  action_description: string;
  priority_base: number;
  steps: string[];
  evidence_required: string[];
  category: string;
  enabled: boolean;
}

export interface NBAAction {
  action_id: string;
  rule_id: string;
  action_type: string;
  title: string;
  description: string;
  priority_score: number;
  category: string;
  steps: string[];
  evidence_required: string[];
  related_asset_ids: string[];
  related_doc_ids: string[];
  estimated_time_minutes: number | null;
  provider_type: string | null;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export interface Provider {
  id: string;
  name: string;
  provider_type: 'attorney' | 'financial_advisor' | 'cpa' | 'insurance_agent' | 'notary' | 'title_company' | 'other';
  specialty: string | null;
  jurisdiction: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  verified: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderVerification {
  id: string;
  provider_id: string;
  verification_type: 'bar_number' | 'license' | 'certification' | 'insurance' | 'other';
  verification_value: string;
  verified_at: string | null;
  verified_by: string | null;
  expiration_date: string | null;
  status: 'pending' | 'verified' | 'expired' | 'rejected';
  created_at: string;
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  trust_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

// ─── Handler Type ───────────────────────────────────────────────────────────

export type RouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData
) => Promise<Response>;

export type OptionalAuthRouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>,
  session: SessionData | null
) => Promise<Response>;
