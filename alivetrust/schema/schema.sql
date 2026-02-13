-- ============================================================================
-- AliveTrust — Living Trust Health & Verification System
-- Database Schema for Cloudflare D1 (SQLite-compatible)
--
-- Version: 2.0.0
-- Created: 2026-02-13
--
-- This schema defines the data model for AliveTrust, a system that helps
-- users track, verify, and score the health of their living trusts.
--
-- Multi-tenant isolation: Every user-facing table includes trust_id + user_id
-- columns. All queries MUST filter on these columns to enforce tenant
-- boundaries. No cross-tenant data access is permitted at the query layer.
--
-- Conventions:
--   - All primary keys are TEXT (UUID v4, generated in application code)
--   - Timestamps are TEXT in ISO 8601 format via datetime('now')
--   - JSON fields are stored as TEXT (SQLite has no native JSON column type)
--   - BOOLEAN columns use INTEGER 0/1 (SQLite convention)
--   - Foreign keys are enforced (PRAGMA foreign_keys = ON must be set at connection time)
--
-- Tables:
--   1.  user                  — User accounts
--   2.  trust_profile         — One trust per row; the central tenant entity
--   3.  asset                 — Real estate, accounts, policies, etc. linked to a trust
--   4.  document              — Trust documents, amendments, deeds, forms, etc.
--   5.  evidence              — Uploaded files / proof tied to assets or documents
--   6.  doc_chunk             — Chunked text for RAG / AI retrieval
--   7.  computation           — Cached trust-health score results
--   8.  audit_log             — Immutable change log for compliance
--   9.  provider              — Estate attorneys, CPAs, advisors directory
--   10. provider_verification — Verification records for provider credentials
--   11. session               — Auth sessions (primary store may be KV; schema here for reference)
--   12. nba_rule              — Next Best Action rules for trust health recommendations
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. user
-- ============================================================================
CREATE TABLE IF NOT EXISTS user (
    id            TEXT PRIMARY KEY,                              -- UUID v4
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    phone         TEXT,
    role          TEXT DEFAULT 'owner'
                       CHECK (role IN ('owner', 'trustee', 'advisor', 'admin')),
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now')),
    last_login    TEXT
);

-- ============================================================================
-- 2. trust_profile
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_profile (
    id                       TEXT PRIMARY KEY,                   -- trust_id (UUID v4)
    user_id                  TEXT NOT NULL REFERENCES user(id),
    trust_name               TEXT NOT NULL,
    trust_type               TEXT NOT NULL
                                  CHECK (trust_type IN ('revocable', 'irrevocable', 'joint', 'special_needs', 'charitable', 'other')),
    jurisdiction             TEXT NOT NULL,
    county                   TEXT,
    date_established         TEXT,                               -- date trust was originally created/signed
    date_last_amended        TEXT,
    grantor_names            TEXT,                               -- JSON array
    trustee_names            TEXT,                               -- JSON array
    successor_trustee_names  TEXT,                               -- JSON array
    beneficiary_names        TEXT,                               -- JSON array
    estimated_estate_value   REAL,
    has_pour_over_will       BOOLEAN DEFAULT 0,
    has_power_of_attorney    BOOLEAN DEFAULT 0,
    has_healthcare_directive BOOLEAN DEFAULT 0,
    status                   TEXT DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'active', 'under_review', 'needs_update')),
    notes                    TEXT,
    created_at               TEXT DEFAULT (datetime('now')),
    updated_at               TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 3. asset
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset (
    id                       TEXT PRIMARY KEY,                   -- UUID v4
    trust_id                 TEXT NOT NULL REFERENCES trust_profile(id),
    user_id                  TEXT REFERENCES user(id),
    asset_type               TEXT NOT NULL
                                  CHECK (asset_type IN ('real_estate', 'bank_account', 'investment', 'retirement', 'life_insurance', 'business_interest', 'vehicle', 'personal_property', 'digital_asset', 'other')),
    name                     TEXT NOT NULL,
    description              TEXT,
    subtype                  TEXT,
    estimated_value          REAL DEFAULT 0,
    ownership_status         TEXT DEFAULT 'unknown'
                                  CHECK (ownership_status IN ('funded', 'unfunded', 'partially_funded', 'beneficiary_designated', 'joint_tenancy', 'unknown')),
    funding_method           TEXT,
    funding_date             TEXT,
    beneficiary_designation  TEXT,
    intended_beneficiary     TEXT,
    location_address         TEXT,
    account_number_last4     TEXT,
    institution              TEXT,
    notes                    TEXT,
    created_at               TEXT DEFAULT (datetime('now')),
    updated_at               TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 4. document
-- ============================================================================
CREATE TABLE IF NOT EXISTS document (
    id              TEXT PRIMARY KEY,                            -- UUID v4
    trust_id        TEXT NOT NULL REFERENCES trust_profile(id),
    user_id         TEXT REFERENCES user(id),
    title           TEXT NOT NULL,
    doc_type        TEXT NOT NULL
                         CHECK (doc_type IN (
                             'trust_agreement', 'amendment', 'restatement',
                             'certificate_of_trust', 'pour_over_will',
                             'power_of_attorney', 'healthcare_directive',
                             'deed', 'beneficiary_designation', 'schedule_a',
                             'other'
                         )),
    status          TEXT DEFAULT 'draft'
                         CHECK (status IN ('current', 'superseded', 'draft', 'expired')),
    file_url        TEXT,
    file_hash       TEXT,
    page_count      INTEGER,
    date_signed     TEXT,
    date_notarized  TEXT,
    expiration_date TEXT,
    required        BOOLEAN DEFAULT 0,
    weight          REAL DEFAULT 1.0,                           -- scoring importance weight
    linked_asset_id TEXT REFERENCES asset(id),
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 5. evidence
-- ============================================================================
CREATE TABLE IF NOT EXISTS evidence (
    id               TEXT PRIMARY KEY,                           -- UUID v4
    trust_id         TEXT NOT NULL REFERENCES trust_profile(id),
    user_id          TEXT REFERENCES user(id),
    evidence_type    TEXT NOT NULL
                          CHECK (evidence_type IN (
                              'title_confirmation', 'account_statement',
                              'beneficiary_confirmation', 'recording_receipt',
                              'notarization_proof', 'transfer_letter',
                              'registration_update', 'other'
                          )),
    related_asset_id TEXT REFERENCES asset(id),
    related_doc_id   TEXT REFERENCES document(id),
    description      TEXT,
    file_url         TEXT,
    file_hash        TEXT,
    file_name        TEXT,
    file_key         TEXT,                                       -- R2 object key (nullable for MVP)
    mime_type        TEXT,
    file_size        INTEGER,
    verified         BOOLEAN DEFAULT 0,
    verified_by      TEXT,
    verified_at      TEXT,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 6. doc_chunk
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_chunk (
    id              TEXT PRIMARY KEY,                            -- chunk_id (UUID v4)
    doc_id          TEXT REFERENCES document(id),
    trust_id        TEXT NOT NULL REFERENCES trust_profile(id),
    user_id         TEXT REFERENCES user(id),
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    token_count     INTEGER,
    source_page     INTEGER,
    metadata        TEXT,                                        -- JSON: page number, section, etc.
    embedding_vector BLOB,                                       -- placeholder for future embeddings
    created_at      TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 7. computation
-- ============================================================================
CREATE TABLE IF NOT EXISTS computation (
    id                        TEXT PRIMARY KEY,                  -- UUID v4
    trust_id                  TEXT NOT NULL REFERENCES trust_profile(id),
    computed_at               TEXT DEFAULT (datetime('now')),
    trust_health_score        REAL,
    funding_coverage_pct      REAL,
    probate_exposure          REAL,
    document_completeness_pct REAL,
    incapacity_readiness_pct  REAL,
    results                   TEXT NOT NULL,                     -- full JSON: scores, gaps, flags, formulas, contributing IDs
    version                   INTEGER DEFAULT 1
);

-- ============================================================================
-- 8. audit_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,                                -- UUID v4
    trust_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,                                  -- e.g. 'asset','document','trust_profile','evidence'
    entity_id   TEXT,
    details     TEXT,                                           -- JSON with action-specific details
    ip_address  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 9. provider
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider (
    id            TEXT PRIMARY KEY,                              -- UUID v4
    name          TEXT NOT NULL,
    provider_type TEXT NOT NULL
                       CHECK (provider_type IN (
                           'attorney', 'financial_advisor', 'cpa',
                           'insurance_agent', 'notary', 'title_company', 'other'
                       )),
    specialty     TEXT,
    jurisdiction  TEXT,
    email         TEXT,
    phone         TEXT,
    website       TEXT,
    address       TEXT,
    verified      BOOLEAN DEFAULT 0,
    rating        REAL,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 10. provider_verification
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_verification (
    id                  TEXT PRIMARY KEY,                        -- UUID v4
    provider_id         TEXT NOT NULL REFERENCES provider(id),
    verification_type   TEXT NOT NULL
                             CHECK (verification_type IN (
                                 'bar_number', 'license', 'certification',
                                 'insurance', 'other'
                             )),
    verification_value  TEXT NOT NULL,
    verified_at         TEXT,
    verified_by         TEXT,
    expiration_date     TEXT,
    status              TEXT DEFAULT 'pending'
                             CHECK (status IN ('pending', 'verified', 'expired', 'rejected')),
    created_at          TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 11. session (KV-backed auth; schema here for reference / fallback)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session (
    id         TEXT PRIMARY KEY,                                 -- session token
    user_id    TEXT NOT NULL REFERENCES user(id),
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    ip_address TEXT
);

-- ============================================================================
-- 12. nba_rule — Next Best Action rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS nba_rule (
    rule_id            TEXT PRIMARY KEY,                         -- UUID v4
    condition_type     TEXT NOT NULL,                            -- 'score', 'count', 'array_contains', 'exists'
    condition_field    TEXT NOT NULL,
    condition_operator TEXT NOT NULL,                            -- 'lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'empty'
    condition_value    TEXT,
    action_type        TEXT NOT NULL,
    action_title       TEXT NOT NULL,
    action_description TEXT,
    priority_base      INTEGER DEFAULT 50,
    steps              TEXT,                                     -- JSON array of step strings
    evidence_required  TEXT,                                     -- JSON array of evidence type strings
    category           TEXT,
    enabled            BOOLEAN DEFAULT 1,
    created_at         TEXT DEFAULT (datetime('now'))
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- trust_profile: tenant lookup by owner
CREATE INDEX IF NOT EXISTS idx_trust_profile_user_id        ON trust_profile(user_id);

-- asset: tenant isolation + type/status queries
CREATE INDEX IF NOT EXISTS idx_asset_trust_id               ON asset(trust_id);
CREATE INDEX IF NOT EXISTS idx_asset_trust_type             ON asset(trust_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_trust_ownership        ON asset(trust_id, ownership_status);

-- document: tenant isolation + type/status queries
CREATE INDEX IF NOT EXISTS idx_document_trust_id            ON document(trust_id);
CREATE INDEX IF NOT EXISTS idx_document_trust_doc_type      ON document(trust_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_document_trust_status        ON document(trust_id, status);

-- evidence: tenant isolation + linked entity lookups
CREATE INDEX IF NOT EXISTS idx_evidence_trust_id            ON evidence(trust_id);
CREATE INDEX IF NOT EXISTS idx_evidence_trust_asset         ON evidence(trust_id, related_asset_id);
CREATE INDEX IF NOT EXISTS idx_evidence_trust_doc           ON evidence(trust_id, related_doc_id);

-- doc_chunk: tenant isolation + source lookups
CREATE INDEX IF NOT EXISTS idx_doc_chunk_trust_id           ON doc_chunk(trust_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunk_doc_id             ON doc_chunk(doc_id);

-- computation: tenant isolation + time-ordered lookups
CREATE INDEX IF NOT EXISTS idx_computation_trust_id         ON computation(trust_id);
CREATE INDEX IF NOT EXISTS idx_computation_trust_computed   ON computation(trust_id, computed_at);

-- audit_log: tenant isolation + time-ordered + entity lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_trust_id           ON audit_log(trust_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_trust_created      ON audit_log(trust_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity             ON audit_log(entity_type, entity_id);

-- provider: type + jurisdiction search
CREATE INDEX IF NOT EXISTS idx_provider_type_jurisdiction   ON provider(provider_type, jurisdiction);
CREATE INDEX IF NOT EXISTS idx_provider_verified            ON provider(verified);

-- provider_verification: provider lookup
CREATE INDEX IF NOT EXISTS idx_provider_verification_pid    ON provider_verification(provider_id);

-- session: user lookup + expiry
CREATE INDEX IF NOT EXISTS idx_session_user_id              ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires_at           ON session(expires_at);

-- nba_rule: enabled rules lookup
CREATE INDEX IF NOT EXISTS idx_nba_rule_enabled             ON nba_rule(enabled);


-- ============================================================================
-- DEMO SEED DATA
-- ============================================================================
-- A complete demo dataset: one user, one trust, several assets, documents,
-- evidence records, a computation, audit entries, and a local provider.
-- All UUIDs use the "demo-" prefix for easy identification and cleanup.
-- ============================================================================

-- Demo user (password_hash is pbkdf2 format — for local testing only)
INSERT INTO user (id, email, password_hash, full_name, phone, role, created_at, updated_at)
VALUES (
    'demo-user-0001-0001-000000000001',
    'maria.santos@example.com',
    'pbkdf2:100000:00000000000000000000000000000000:demohashnotreal00000000000000000000000000000000000000000000000000',
    'Maria Santos',
    '+1-626-555-0100',
    'owner',
    '2025-09-15T10:00:00Z',
    '2026-02-01T08:30:00Z'
);

-- Demo trust profile
INSERT INTO trust_profile (
    id, user_id, trust_name, trust_type, jurisdiction, county,
    date_established, date_last_amended,
    grantor_names, trustee_names, successor_trustee_names, beneficiary_names,
    estimated_estate_value, has_pour_over_will, has_power_of_attorney, has_healthcare_directive,
    status, notes, created_at, updated_at
) VALUES (
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'The Santos Family Living Trust',
    'revocable',
    'California',
    'Los Angeles',
    '2021-03-15',
    '2024-01-10',
    '["Maria Santos", "David Santos"]',
    '["Maria Santos", "David Santos"]',
    '["Elena Santos-Rivera"]',
    '["Sofia Santos", "Lucas Santos", "Elena Santos-Rivera"]',
    2085000.00,
    1,
    1,
    1,
    'active',
    'Originally created with Law Offices of Chen & Associates. Last amended to update successor trustee.',
    '2025-09-15T10:05:00Z',
    '2026-02-01T08:30:00Z'
);

-- Demo assets
INSERT INTO asset (id, trust_id, user_id, asset_type, name, description, subtype, estimated_value, ownership_status, funding_method, funding_date, beneficiary_designation, intended_beneficiary, location_address, institution, notes, created_at, updated_at)
VALUES
(
    'demo-asset-0001-0001-000000000001',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'real_estate',
    'Primary Residence — 742 Evergreen Terrace',
    'Single-family residence in Pasadena',
    'single_family',
    875000.00,
    'funded',
    'Grant deed recorded with county',
    '2021-04-01',
    NULL,
    'Sofia Santos and Lucas Santos (equal shares)',
    '742 Evergreen Terrace, Pasadena, CA 91101',
    NULL,
    'Title transferred to trust via grant deed on 2021-04-01. Property tax reassessment exclusion filed.',
    '2025-09-15T10:10:00Z',
    '2026-01-15T09:00:00Z'
),
(
    'demo-asset-0001-0001-000000000002',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'investment',
    'Schwab Joint Brokerage Account',
    'Index funds and bonds brokerage account',
    'brokerage',
    342000.00,
    'funded',
    'Account retitled to trust',
    '2021-05-20',
    NULL,
    'Sofia Santos and Lucas Santos (equal shares)',
    NULL,
    'Charles Schwab',
    'Account retitled 2021-05. Holds index funds and bonds.',
    '2025-09-15T10:15:00Z',
    '2026-01-15T09:00:00Z'
),
(
    'demo-asset-0001-0001-000000000003',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'life_insurance',
    'Nationwide Term Life Policy',
    'Term life insurance policy',
    'term_life',
    500000.00,
    'unfunded',
    NULL,
    NULL,
    'Elena Santos-Rivera',
    'The Santos Family Living Trust',
    NULL,
    'Nationwide Insurance',
    'Beneficiary designation still names individual, not the trust. Needs update.',
    '2025-09-15T10:20:00Z',
    '2026-02-01T08:30:00Z'
),
(
    'demo-asset-0001-0001-000000000004',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'retirement',
    'Fidelity 401(k) — Maria',
    '401(k) retirement account',
    '401k',
    218000.00,
    'partially_funded',
    'Beneficiary designation (cannot retitle to trust)',
    NULL,
    'David Santos (primary), Trust (contingent)',
    'David Santos (primary), The Santos Family Living Trust (contingent)',
    NULL,
    'Fidelity Investments',
    'Primary beneficiary is spouse. Contingent beneficiary should name trust but form is outdated (pre-amendment).',
    '2025-09-15T10:25:00Z',
    '2026-02-01T08:30:00Z'
),
(
    'demo-asset-0001-0001-000000000005',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'business_interest',
    'Santos Consulting LLC',
    'LLC membership interest',
    'llc',
    150000.00,
    'unknown',
    NULL,
    NULL,
    NULL,
    'Sofia Santos and Lucas Santos',
    '9100 Wilshire Blvd, Suite 400, Beverly Hills, CA 90212',
    'California Secretary of State',
    'Operating agreement does not mention trust. Membership interest transfer needed.',
    '2025-10-01T14:00:00Z',
    '2026-02-01T08:30:00Z'
);

-- Demo documents
INSERT INTO document (id, trust_id, user_id, title, doc_type, status, file_url, file_hash, page_count, date_signed, date_notarized, expiration_date, required, weight, linked_asset_id, notes, created_at, updated_at)
VALUES
(
    'demo-doc-0001-0001-000000000001',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Santos Family Living Trust Agreement',
    'trust_agreement',
    'current',
    NULL,
    NULL,
    42,
    '2021-03-15',
    '2021-03-15',
    NULL,
    1,
    3.0,
    NULL,
    'Original trust instrument, 42 pages. Signed by both grantors.',
    '2025-09-15T10:30:00Z',
    '2025-09-15T10:30:00Z'
),
(
    'demo-doc-0001-0001-000000000002',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'First Amendment to Santos Family Trust',
    'amendment',
    'current',
    NULL,
    NULL,
    4,
    '2024-01-10',
    '2024-01-10',
    NULL,
    1,
    2.5,
    NULL,
    'Updated successor trustee from James Santos to Elena Santos-Rivera.',
    '2025-09-15T10:35:00Z',
    '2025-09-15T10:35:00Z'
),
(
    'demo-doc-0001-0001-000000000003',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Pour-Over Will — Maria Santos',
    'pour_over_will',
    'current',
    NULL,
    NULL,
    6,
    '2021-03-15',
    NULL,
    NULL,
    1,
    2.0,
    NULL,
    'Directs any probate assets into the trust. Signed same day as trust.',
    '2025-09-15T10:40:00Z',
    '2025-09-15T10:40:00Z'
),
(
    'demo-doc-0001-0001-000000000004',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Grant Deed — 742 Evergreen Terrace',
    'deed',
    'current',
    NULL,
    NULL,
    3,
    '2021-04-01',
    '2021-04-01',
    NULL,
    1,
    2.0,
    'demo-asset-0001-0001-000000000001',
    'Recorded with LA County Recorder. Document number 2021-0456789.',
    '2025-09-15T10:45:00Z',
    '2025-09-15T10:45:00Z'
),
(
    'demo-doc-0001-0001-000000000005',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Certificate of Trust',
    'certificate_of_trust',
    'superseded',
    NULL,
    NULL,
    2,
    '2021-03-15',
    NULL,
    NULL,
    1,
    1.5,
    NULL,
    'Original certificate pre-dates the 2024 amendment. Financial institutions may require an updated version.',
    '2025-09-15T10:50:00Z',
    '2026-02-01T08:30:00Z'
),
(
    'demo-doc-0001-0001-000000000006',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Healthcare Directive — Maria Santos',
    'healthcare_directive',
    'current',
    NULL,
    NULL,
    8,
    '2021-03-15',
    '2021-03-15',
    NULL,
    1,
    1.5,
    NULL,
    'Names David Santos as primary agent, Elena Santos-Rivera as alternate.',
    '2025-09-15T10:55:00Z',
    '2025-09-15T10:55:00Z'
),
(
    'demo-doc-0001-0001-000000000007',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Financial Power of Attorney — Maria Santos',
    'power_of_attorney',
    'current',
    NULL,
    NULL,
    10,
    '2021-03-15',
    '2021-03-15',
    NULL,
    1,
    1.5,
    NULL,
    'Durable POA naming David Santos. Springing on incapacity.',
    '2025-09-15T10:58:00Z',
    '2025-09-15T10:58:00Z'
),
(
    'demo-doc-0001-0001-000000000008',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Schwab Account Title Change Confirmation',
    'other',
    'current',
    NULL,
    NULL,
    1,
    '2021-05-20',
    NULL,
    NULL,
    0,
    1.0,
    'demo-asset-0001-0001-000000000002',
    'Confirmation letter from Schwab showing account retitled to trust.',
    '2025-10-05T11:00:00Z',
    '2025-10-05T11:00:00Z'
),
(
    'demo-doc-0001-0001-000000000009',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Nationwide Beneficiary Designation Form',
    'beneficiary_designation',
    'draft',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    1.5,
    'demo-asset-0001-0001-000000000003',
    'Need to obtain and file updated beneficiary designation naming trust as owner/beneficiary.',
    '2025-10-10T09:00:00Z',
    '2026-02-01T08:30:00Z'
),
(
    'demo-doc-0001-0001-000000000010',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'Santos Consulting LLC Operating Agreement',
    'other',
    'draft',
    NULL,
    NULL,
    15,
    '2019-06-01',
    NULL,
    NULL,
    1,
    1.5,
    'demo-asset-0001-0001-000000000005',
    'Current agreement does not reference the trust. Attorney needs to draft assignment of membership interest.',
    '2025-10-15T09:00:00Z',
    '2026-02-01T08:30:00Z'
);

-- Demo evidence
INSERT INTO evidence (id, trust_id, user_id, evidence_type, related_asset_id, related_doc_id, description, file_url, file_hash, file_name, mime_type, file_size, verified, verified_by, verified_at, notes, created_at)
VALUES
(
    'demo-evid-0001-0001-000000000001',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'notarization_proof',
    NULL,
    'demo-doc-0001-0001-000000000001',
    'Full scan of executed trust agreement, all 42 pages.',
    NULL,
    NULL,
    'santos-trust-agreement-signed.pdf',
    'application/pdf',
    2048576,
    1,
    'system',
    '2025-09-16T08:01:00Z',
    'Full scan of executed trust agreement, all 42 pages.',
    '2025-09-16T08:00:00Z'
),
(
    'demo-evid-0001-0001-000000000002',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'recording_receipt',
    'demo-asset-0001-0001-000000000001',
    'demo-doc-0001-0001-000000000004',
    'Recorded grant deed transferring property to trust.',
    NULL,
    NULL,
    'grant-deed-742-evergreen.pdf',
    'application/pdf',
    1524288,
    1,
    'system',
    '2025-09-16T08:06:00Z',
    'Recorded grant deed transferring property to trust.',
    '2025-09-16T08:05:00Z'
),
(
    'demo-evid-0001-0001-000000000003',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'title_confirmation',
    'demo-asset-0001-0001-000000000002',
    'demo-doc-0001-0001-000000000008',
    'Schwab confirmation letter showing account now titled in name of trust.',
    NULL,
    NULL,
    'schwab-retitle-confirmation.pdf',
    'application/pdf',
    524288,
    1,
    'system',
    '2025-10-05T11:06:00Z',
    'Schwab confirmation letter showing account now titled in name of trust.',
    '2025-10-05T11:05:00Z'
),
(
    'demo-evid-0001-0001-000000000004',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'account_statement',
    'demo-asset-0001-0001-000000000004',
    NULL,
    'Screenshot of Fidelity beneficiary page. Shows David as primary but contingent may be outdated.',
    NULL,
    NULL,
    'fidelity-401k-beneficiary-screenshot.png',
    'image/png',
    312000,
    0,
    NULL,
    NULL,
    'Screenshot of Fidelity beneficiary page. Shows David as primary but contingent may be outdated.',
    '2025-11-20T14:30:00Z'
);

-- Demo computation (trust health score result)
INSERT INTO computation (id, trust_id, computed_at, trust_health_score, funding_coverage_pct, probate_exposure, document_completeness_pct, incapacity_readiness_pct, results, version)
VALUES (
    'demo-comp-0001-0001-000000000001',
    'demo-trust-0001-0001-000000000001',
    '2026-02-01T09:00:00Z',
    72,
    60,
    150000,
    82,
    100,
    '{
        "funding_coverage_value_pct": 60,
        "funding_coverage_count_pct": 40,
        "probate_exposure_amount": 150000,
        "probate_exposure_assets": ["demo-asset-0001-0001-000000000005"],
        "document_completeness_score": 82,
        "incapacity_readiness_score": 100,
        "evidence_completeness_pct": 60,
        "red_flags": [
            { "flag_id": "rf-0001", "type": "unfunded_real_estate", "severity": "high", "message": "Life insurance policy not owned by trust and beneficiary not updated", "related_asset_ids": ["demo-asset-0001-0001-000000000003"], "related_doc_ids": [] },
            { "flag_id": "rf-0002", "type": "business_transfer_unknown", "severity": "high", "message": "LLC operating agreement does not reference trust", "related_asset_ids": ["demo-asset-0001-0001-000000000005"], "related_doc_ids": [] },
            { "flag_id": "rf-0003", "type": "outdated_documents", "severity": "medium", "message": "Certificate of trust predates 2024 amendment", "related_asset_ids": [], "related_doc_ids": ["demo-doc-0001-0001-000000000005"] }
        ],
        "formulas": {
            "funding_coverage_value": "funded_value / total_value = $1,217,000 / $2,085,000 = 58.37%",
            "funding_coverage_count": "funded_count / total_fundable = 2 / 5 = 40%",
            "probate_exposure": "sum of unfunded asset values: Santos Consulting LLC ($150,000) = $150,000",
            "document_completeness": "trust_agreement: 3/3 (complete), pour_over_will: 2/2 (complete), power_of_attorney: 2.5/2.5 (complete), healthcare_directive: 2/2 (complete), certificate_of_trust: 0/1.5 (superseded) => 9.5/11 = 86.36%",
            "incapacity_readiness": "healthcare_directive: 30/30 + financial_poa: 30/30 + successor_trustee: 20/20 + certificate_of_trust: 20/20 = 100/100 = 100%",
            "evidence_completeness": "items_with_evidence / total_items = (3 assets + 3 docs) / (5 assets + 7 docs) = 6 / 12 = 50%"
        },
        "contributing_asset_ids": {
            "funded_value": ["demo-asset-0001-0001-000000000001", "demo-asset-0001-0001-000000000002"],
            "funded_count": ["demo-asset-0001-0001-000000000001", "demo-asset-0001-0001-000000000002"],
            "probate_exposed": ["demo-asset-0001-0001-000000000005"],
            "evidence_covered_assets": ["demo-asset-0001-0001-000000000001", "demo-asset-0001-0001-000000000002", "demo-asset-0001-0001-000000000004"]
        },
        "contributing_evidence_ids": {
            "asset_evidence": ["demo-evid-0001-0001-000000000002", "demo-evid-0001-0001-000000000003", "demo-evid-0001-0001-000000000004"],
            "document_evidence": ["demo-evid-0001-0001-000000000001", "demo-evid-0001-0001-000000000002", "demo-evid-0001-0001-000000000003"]
        },
        "data_gaps": [
            { "gap_id": "dg-0001", "field": "assets[demo-asset-0001-0001-000000000005].ownership_status", "message": "Asset \"Santos Consulting LLC\" has unknown funding status.", "resolution_hint": "Check whether this asset has been retitled to the trust or has the trust as beneficiary." }
        ]
    }',
    1
);

-- Demo audit log entries
INSERT INTO audit_log (id, trust_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
VALUES
(
    'demo-audit-0001-0001-000000000001',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'CREATE',
    'trust_profile',
    'demo-trust-0001-0001-000000000001',
    '{"trust_name": "The Santos Family Living Trust", "trust_type": "revocable"}',
    '203.0.113.42',
    '2025-09-15T10:05:00Z'
),
(
    'demo-audit-0001-0001-000000000002',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'CREATE',
    'asset',
    'demo-asset-0001-0001-000000000001',
    '{"asset_type": "real_estate", "name": "Primary Residence — 742 Evergreen Terrace"}',
    '203.0.113.42',
    '2025-09-15T10:10:00Z'
),
(
    'demo-audit-0001-0001-000000000003',
    'demo-trust-0001-0001-000000000001',
    'demo-user-0001-0001-000000000001',
    'COMPUTE',
    'computation',
    'demo-comp-0001-0001-000000000001',
    '{"trust_health_score": 72, "version": 1, "red_flag_count": 3, "data_gap_count": 1}',
    '203.0.113.42',
    '2026-02-01T09:00:00Z'
);

-- Demo provider
INSERT INTO provider (id, name, provider_type, specialty, jurisdiction, email, phone, website, address, verified, rating, created_at, updated_at)
VALUES (
    'demo-prov-0001-0001-000000000001',
    'Chen & Associates, Estate Law',
    'attorney',
    'estate_planning',
    'California',
    'info@chenestatelaw.example.com',
    '+1-626-555-0198',
    'https://chenestatelaw.example.com',
    '100 W Colorado Blvd, Suite 200, Pasadena, CA 91105',
    1,
    4.8,
    '2025-11-01T10:00:00Z',
    '2025-11-01T10:00:00Z'
);

-- Demo provider verification
INSERT INTO provider_verification (id, provider_id, verification_type, verification_value, verified_at, verified_by, expiration_date, status, created_at)
VALUES (
    'demo-pver-0001-0001-000000000001',
    'demo-prov-0001-0001-000000000001',
    'bar_number',
    '123456',
    '2025-11-01T10:05:00Z',
    'system',
    '2027-02-01T00:00:00Z',
    'verified',
    '2025-11-01T10:00:00Z'
);

-- Demo session
INSERT INTO session (id, user_id, created_at, expires_at, ip_address)
VALUES (
    'demo-session-token-abc123xyz',
    'demo-user-0001-0001-000000000001',
    '2026-02-13T08:00:00Z',
    '2026-02-14T08:00:00Z',
    '203.0.113.42'
);

-- Demo NBA rules
INSERT INTO nba_rule (rule_id, condition_type, condition_field, condition_operator, condition_value, action_type, action_title, action_description, priority_base, steps, evidence_required, category, enabled)
VALUES
(
    'nba-rule-0001',
    'score',
    'funding_coverage_value_pct',
    'lt',
    '50',
    'fund_asset',
    'Fund unfunded assets into the trust',
    'One or more high-value assets are not yet titled in the name of the trust. Transferring ownership reduces probate exposure.',
    80,
    '["Identify unfunded assets", "Contact institution or attorney", "Complete transfer/retitling paperwork", "Upload evidence of transfer"]',
    '["title_confirmation", "transfer_letter"]',
    'funding',
    1
),
(
    'nba-rule-0002',
    'count',
    'missing_docs',
    'gt',
    '0',
    'upload_document',
    'Upload missing required documents',
    'One or more required trust documents are missing. Completing your document set improves trust health and incapacity readiness.',
    70,
    '["Review list of missing documents", "Locate or request documents from attorney", "Upload scanned copies", "Mark documents as current"]',
    '["notarization_proof"]',
    'documents',
    1
),
(
    'nba-rule-0003',
    'score',
    'incapacity_readiness_score',
    'lt',
    '60',
    'contact_attorney',
    'Improve incapacity readiness',
    'Your trust is missing key incapacity planning documents. Contact your estate attorney to prepare these critical documents.',
    90,
    '["Schedule consultation with estate attorney", "Discuss power of attorney and healthcare directive needs", "Execute and notarize documents", "Upload completed documents"]',
    '["notarization_proof"]',
    'incapacity',
    1
),
(
    'nba-rule-0004',
    'score',
    'document_completeness_score',
    'lt',
    '80',
    'review_trust',
    'Schedule a trust review with your attorney',
    'Your document completeness score indicates gaps in your trust documentation. A comprehensive review can identify and resolve these issues.',
    60,
    '["Contact your estate attorney", "Bring current asset list and documents", "Review and update trust terms", "Execute any needed amendments"]',
    '[]',
    'review',
    1
),
(
    'nba-rule-0005',
    'count',
    'red_flags',
    'gt',
    '2',
    'review_trust',
    'Address critical red flags',
    'Multiple red flags have been detected in your trust health analysis. Prioritize resolving these to protect your estate plan.',
    85,
    '["Review red flags in your trust health report", "Prioritize critical and high-severity flags", "Consult with appropriate professionals", "Take corrective action for each flag"]',
    '[]',
    'review',
    1
);
