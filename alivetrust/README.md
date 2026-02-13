# AliveTrust

A living trust health, verification, and coaching operating system.

AliveTrust helps individuals and families understand, verify, and maintain their living trusts through deterministic scoring, evidence-based verification, and guided next-best-action coaching.

## Core Principles

1. **No hallucinations** -- All scoring is deterministic and rule-based. AI only explains computed results.
2. **Evidence-based** -- Every claim cites user document chunks or verified official sources.
3. **Not legal advice** -- Educational tools with professional routing for complex situations.
4. **Privacy-first** -- Multi-tenant isolation. Your data is yours.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Cloudflare Pages (HTML/CSS/JS) |
| API | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Sessions | Cloudflare KV |
| Storage | R2 (optional, for evidence files) |

## Features

- **Trust Health Dashboard** -- 6 deterministic scorecards with explainable formulas
- **My Equity Map** -- Asset inventory with funding status tracking
- **My Next 3 Moves** -- Prioritized action plan from rule-based NBA engine
- **My Proof Pack** -- Document and evidence management
- **Provider Directory** -- Verified professionals with credential transparency
- **Export** -- Health report and trustee packet generation

## Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup instructions.

## Review

See [REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md) for the human review checklist.

---

Built by Novai Systems LLC.

*AliveTrust provides educational tools for estate planning awareness. This is not legal advice.*
