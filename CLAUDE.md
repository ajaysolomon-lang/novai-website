# CLAUDE.md — Novai Systems Marketing Website

## Project Overview

Static marketing and lead-capture website for **Novai Systems LLC**, an AI tools company based in Los Angeles. The site promotes four products (AIREC, Industry Diagnostic, Command Console, WorkBench) and captures leads via an interactive sales chatbot.

- **Domain:** `novaisystems.online`
- **Hosting:** Netlify (static files) + Cloudflare Workers (widget injection)
- **Related domain:** `workbench.novaisystems.online` (separate product)

## Tech Stack

- **Pure HTML5 / CSS3 / Vanilla JavaScript** — no frameworks, no build tools, no npm
- No package.json, no bundler, no transpiler
- No test framework or linting tools
- Deployed as static files directly to Netlify

## File Structure

```
├── index.html              # Single-page marketing site (all sections)
├── style.css               # Global stylesheet (CSS custom properties)
├── script.js               # Minimal init script (console log only)
├── sales-agent.js          # Interactive GTM sales chatbot (~676 lines, IIFE)
├── widget.js               # WorkBench floating widget (IIFE)
├── _redirects              # Netlify SPA routing + static file rules
├── _headers                # Netlify response headers (CORS for widget.js)
├── robots.txt              # Allows search engines, blocks AI crawlers
├── sitemap.xml             # SEO sitemap (points to WorkBench domain)
├── humans.txt              # Humans.txt metadata
├── .well-known/
│   └── security.txt        # Security contact info
└── worker/
    ├── wrangler.toml       # Cloudflare Worker config
    └── widget-injector.js  # Injects widget + sales-agent into HTML responses
```

## Architecture

### No Build Step

Files are served as-is. There is no compilation, transpilation, or bundling. Edit files directly and deploy.

### Netlify Configuration

- `_redirects`: Static SEO files (`robots.txt`, `sitemap.xml`, `humans.txt`, `security.txt`) served at their paths; everything else falls back to `index.html` for SPA behavior.
- `_headers`: Sets `Content-Type` for static files and `Access-Control-Allow-Origin: *` on `widget.js` for cross-origin embedding.

### Cloudflare Worker (`worker/`)

- `widget-injector.js` intercepts requests on `novaisystems.online/*` and injects the WorkBench widget HTML and sales-agent script into all HTML responses.
- Configured via `wrangler.toml` with compatibility date `2024-01-01`.

## Code Conventions

### JavaScript Patterns

- **IIFE wrapping:** All JS files use `(function() { ... })()` to avoid global scope pollution.
- **DOM API only:** `createElement`, `appendChild`, `innerHTML` — no jQuery, no virtual DOM.
- **Inline CSS injection:** Widget scripts create `<style>` elements and set `textContent` for self-contained styling.
- **State in localStorage:** Sales agent persists leads and dismissal state in `localStorage` keys prefixed with `novai_`.

### CSS Conventions

- **CSS custom properties** defined on `:root` for theming:
  - `--primary` (#0a2540), `--accent` (#0077ff), `--accent2` (#00bbff)
  - `--bg` (#050a12), `--surface` (#0d1117), `--surface2` (#161b22)
  - `--text` (#e6edf3), `--text-dim` (rgba)
- **No preprocessor** — plain CSS only.
- **Single global stylesheet** (`style.css`) for the main page.
- **Responsive:** Mobile breakpoint at `max-width: 480px`.

### Naming Conventions

- CSS classes: `novai-` prefix for widget/agent elements (e.g., `novai-sa-toggle`, `novai-sales-agent`, `novai-workbench-widget`).
- JS flow/state keys: `snake_case` (e.g., `airec_intro`, `capture_success`).
- HTML sections: Marked with comment separators (`<!-- ─── Section Name ─── -->`).

## Key Components

### `sales-agent.js` (Lead Capture Chatbot)

The largest file in the project. A self-contained conversational sales agent that:
- Presents product information via guided conversation flows
- Captures lead data (name, email, phone, product interest)
- Stores leads in `localStorage` and submits to any on-page intake forms
- Auto-opens after 8 seconds (unless dismissed in last 24 hours)
- Shows notification badge after 3 seconds

Product knowledge and conversation flows are embedded as JS objects (`PRODUCTS`, `FLOWS`).

### `widget.js` (WorkBench Widget)

A floating bottom-right widget linking to WorkBench. Self-contained with inline styles. Positioned at `bottom: 92px` to sit above the sales agent toggle.

### `index.html` (Marketing Page)

Single-page structure with sections: Header, Hero, Proof Bar, Products (4-card grid), Stats, Differentiator, CTA, Footer. Includes comprehensive structured data (JSON-LD) for SEO/AEO: WebSite, Organization, LocalBusiness, SoftwareApplication, FAQPage schemas.

## SEO & Metadata

- Full Open Graph and Twitter Card meta tags
- Five JSON-LD structured data blocks in `<head>`
- `robots.txt` blocks AI training crawlers (GPTBot, ClaudeBot, CCBot, etc.) while allowing search engines
- Canonical URL: `https://novaisystems.online/`

## Development Workflow

1. **Edit files directly** — no build/compile step needed.
2. **Test locally** by opening `index.html` in a browser (sales agent and widget work standalone).
3. **Deploy** by pushing to the appropriate branch; Netlify picks up changes automatically.
4. **Worker changes** require deployment via `wrangler deploy` from the `worker/` directory.

## Important Notes

- There are **no tests, linters, or type checkers** in this project. Validate changes manually in-browser.
- The sales agent phone number `+1 (213) 943-3042` appears in multiple places (HTML, JSON-LD schemas, sales-agent.js). Keep them in sync when changing.
- `widget.js` is served with CORS headers (`Access-Control-Allow-Origin: *`) because it is loaded cross-origin by other Novai sites.
- The `novai_website_bundle.zip` in the root is a static archive of the site — do not modify it directly; it may be outdated.
- All product information and conversation flows in `sales-agent.js` are hardcoded. There is no CMS or external data source.
