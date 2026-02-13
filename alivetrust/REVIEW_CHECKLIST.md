# AliveTrust — Human Review Checklist

Use this checklist to verify the MVP before launch.

---

## Architecture & Security

- [ ] All API endpoints require authentication (except `/auth/register`, `/auth/login`)
- [ ] Tenant isolation: every query is scoped by `trust_id` + `user_id`
- [ ] No SQL injection vectors (all queries use parameterized `.bind()`)
- [ ] No XSS vectors in frontend (no `innerHTML` with user data without sanitization)
- [ ] Passwords hashed with PBKDF2 + salt (never stored in plain text)
- [ ] Session tokens stored in KV with TTL expiration
- [ ] CORS headers only allow specified origin
- [ ] No secrets committed to repository

## Data Integrity

- [ ] D1 schema has foreign keys defined
- [ ] All tables have `created_at` timestamps
- [ ] Audit log captures before/after JSON for all mutations
- [ ] UUID generation uses `crypto.randomUUID()`
- [ ] Demo dataset loads correctly and produces stable scores

## Scoring Engine (Deterministic)

- [ ] Funding coverage calculation excludes retirement/insurance from count metric
- [ ] Probate exposure only sums unfunded asset values
- [ ] Document completeness uses weighted scoring
- [ ] Incapacity readiness checks all 4 components
- [ ] Evidence completeness counts both asset and document evidence
- [ ] Red flags detect all 9+ conditions with correct severity
- [ ] Data gaps flag unknown/missing values
- [ ] Every metric returns: formula string, contributing asset IDs, contributing evidence IDs
- [ ] Same input always produces same output (no randomness)
- [ ] No LLM/AI calls in scoring — purely rule-based

## NBA Engine

- [ ] Rules loaded from `nba_rules_v1.json`
- [ ] Priority formula: `(risk_reduction * 0.45 + equity_protected * 0.35 + time_score * 0.10 + dependency_unlock * 0.10)`
- [ ] Top 3 actions returned separately from backlog
- [ ] Each action includes: `steps`, `evidence_required`, `done_definition`, `escalation_conditions`
- [ ] Owner suggestions are appropriate (grantor vs attorney vs advisor)

## RAG Engine

- [ ] User documents chunked and stored with chunk IDs
- [ ] Verified sources ingested with `source_id` citations
- [ ] Query results include citations array
- [ ] `DATA GAP` flagged when insufficient support
- [ ] Legal disclaimer included in every response
- [ ] Never provides legal determinations — only education + process + professional routing

## Provider Directory

- [ ] Only shows providers with verification metadata
- [ ] "Why shown" explanation present for each provider
- [ ] Official verification URLs are real and functional
- [ ] Consent gate before sharing user data
- [ ] Disclaimer: not a referral or endorsement

## Frontend UI

- [ ] Onboarding wizard completes successfully (4 steps)
- [ ] My Equity Map shows all assets with correct badges
- [ ] Trust Health Dashboard shows all 6 scorecards
- [ ] Score colors: green > 80%, amber 50-80%, red < 50%
- [ ] Click-to-expand shows formula and contributing items
- [ ] My Next 3 Moves displays correctly from NBA engine
- [ ] My Proof Pack shows documents and evidence
- [ ] Provider Directory search works with filters
- [ ] Responsive design works on mobile (768px breakpoint)
- [ ] Loading states shown during API calls
- [ ] Error states handled gracefully
- [ ] "What changed since last time" section shows differences

## Legal & Compliance

- [ ] "Not legal advice" disclaimer on dashboard
- [ ] "Not legal advice" disclaimer on provider page
- [ ] "Not legal advice" disclaimer in export PDFs
- [ ] Professional routing suggested for complex situations
- [ ] No invented/hallucinated facts in any guidance
- [ ] All guidance citations point to verified sources or user doc chunks
- [ ] No provider endorsements — only verified credentials shown

## Exports

- [ ] Health Report includes: scores, exposure list, NBA, evidence index
- [ ] Trustee Packet includes: trust summary, trustees, contacts, assets, evidence, break-glass
- [ ] Both include legal disclaimer
- [ ] Generated timestamps present

## Automation & Change Tracking

- [ ] Recompute triggered when asset added/changed
- [ ] Recompute triggered when document status changed
- [ ] Change log stored in `audit_log`
- [ ] "What changed since last time" compares current vs previous computation

## Tests

- [ ] Scoring unit tests pass
- [ ] NBA ranking unit tests pass
- [ ] Demo dataset produces stable, explainable output
- [ ] Tenant isolation tests documented (integration)
- [ ] Audit log tests documented

## Deployment

- [ ] D1 database created and schema applied
- [ ] KV namespace created and bound
- [ ] Worker deployed and responding
- [ ] Pages deployed and loading
- [ ] Custom domains configured (if applicable)
- [ ] API URL configured in frontend
- [ ] Verified sources seeded
- [ ] Demo dataset loaded (for testing)
