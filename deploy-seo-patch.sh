#!/bin/bash
set -euo pipefail

#============================================================
# SEO PATCH DEPLOY SCRIPT — v8.1+ NO-BURNS
#
# This script injects SEO discovery files into your existing
# Cloudflare Pages deployment WITHOUT rebuilding the Vite app.
#
# USAGE:
#   ./deploy-seo-patch.sh <path-to-dist> <cloudflare-project-name>
#
# EXAMPLE:
#   ./deploy-seo-patch.sh ~/workbench/dist workbench-novai
#
# WHAT IT DOES:
#   1. Copies robots.txt, sitemap.xml, humans.txt, security.txt into dist/
#   2. Adds _redirects with carve-outs ABOVE the SPA catch-all
#   3. Adds _headers with correct Content-Types
#   4. Deploys to Cloudflare Pages via wrangler
#   5. Verifies with curl
#
# WHAT IT DOES NOT TOUCH:
#   - index.html (your Vite build is preserved exactly)
#   - /assets/ (JS/CSS bundles untouched)
#   - Any app routes, Turnstile, Stripe, etc.
#============================================================

DIST_DIR="${1:-}"
PROJECT_NAME="${2:-}"

if [ -z "$DIST_DIR" ] || [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./deploy-seo-patch.sh <path-to-dist> <cloudflare-project-name>"
  echo ""
  echo "  <path-to-dist>           Path to your Vite dist/ folder"
  echo "  <cloudflare-project-name> Your Cloudflare Pages project name"
  echo ""
  echo "Example:"
  echo "  ./deploy-seo-patch.sh ~/workbench/dist workbench-novai"
  echo ""
  echo "To find your project name, run:"
  echo "  npx wrangler pages project list"
  exit 1
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: Directory '$DIST_DIR' does not exist."
  exit 1
fi

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERROR: No index.html found in '$DIST_DIR'. Is this the right dist folder?"
  exit 1
fi

echo "=== SEO PATCH v8.1+ ==="
echo "Target: $DIST_DIR"
echo "Project: $PROJECT_NAME"
echo ""

# --- 1. Create robots.txt ---
echo "[1/7] Writing robots.txt..."
cat > "$DIST_DIR/robots.txt" << 'ROBOTS'
User-agent: *
Allow: /
Sitemap: https://workbench.novaisystems.online/sitemap.xml

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /
ROBOTS

# --- 2. Create sitemap.xml ---
echo "[2/7] Writing sitemap.xml..."
cat > "$DIST_DIR/sitemap.xml" << 'SITEMAP'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://workbench.novaisystems.online/</loc></url>
  <url><loc>https://workbench.novaisystems.online/services</loc></url>
  <url><loc>https://workbench.novaisystems.online/signup</loc></url>
  <url><loc>https://workbench.novaisystems.online/login</loc></url>
</urlset>
SITEMAP

# --- 3. Create humans.txt ---
echo "[3/7] Writing humans.txt..."
cat > "$DIST_DIR/humans.txt" << 'HUMANS'
WorkBench by Novai Systems LLC
Site: https://workbench.novaisystems.online
Company: Novai Systems LLC
Phone: +1-213-943-3042
Launch: Los Angeles, CA (MVP)
HUMANS

# --- 4. Create .well-known/security.txt ---
echo "[4/7] Writing .well-known/security.txt..."
mkdir -p "$DIST_DIR/.well-known"
cat > "$DIST_DIR/.well-known/security.txt" << 'SECURITY'
Contact: mailto:security@novaisystems.online
Preferred-Languages: en
Expires: 2027-12-31T23:59:59Z
SECURITY

# --- 5. Create _redirects (THE CRITICAL FIX) ---
echo "[5/7] Writing _redirects (SPA catch-all fix)..."
cat > "$DIST_DIR/_redirects" << 'REDIRECTS'
# Static SEO/discovery files — serve as-is (ABOVE catch-all)
/robots.txt /robots.txt 200
/sitemap.xml /sitemap.xml 200
/humans.txt /humans.txt 200
/.well-known/security.txt /.well-known/security.txt 200

# SPA catch-all fallback (preserves existing app routing)
/* /index.html 200
REDIRECTS

# --- 6. Create _headers ---
echo "[6/7] Writing _headers..."
cat > "$DIST_DIR/_headers" << 'HEADERS'
/robots.txt
  Content-Type: text/plain; charset=utf-8

/sitemap.xml
  Content-Type: application/xml; charset=utf-8

/humans.txt
  Content-Type: text/plain; charset=utf-8

/.well-known/security.txt
  Content-Type: text/plain; charset=utf-8
HEADERS

# --- 7. Verify files before deploy ---
echo "[7/7] Verifying files in $DIST_DIR..."
echo ""
FAIL=0
for f in robots.txt sitemap.xml humans.txt .well-known/security.txt _redirects _headers; do
  if [ -f "$DIST_DIR/$f" ]; then
    echo "  OK: $f"
  else
    echo "  MISSING: $f"
    FAIL=1
  fi
done

# Verify robots.txt has no HTML
if grep -q "<!DOCTYPE" "$DIST_DIR/robots.txt" 2>/dev/null; then
  echo "  FAIL: robots.txt contains HTML!"
  FAIL=1
fi

# Verify sitemap.xml starts with <?xml
if ! head -1 "$DIST_DIR/sitemap.xml" | grep -q "<?xml" 2>/dev/null; then
  echo "  FAIL: sitemap.xml doesn't start with <?xml!"
  FAIL=1
fi

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "ERROR: Pre-deploy validation failed. Aborting."
  exit 1
fi

echo ""
echo "All files verified. Deploying to Cloudflare Pages..."
echo ""

# --- Deploy ---
npx wrangler pages deploy "$DIST_DIR" --project-name="$PROJECT_NAME"

echo ""
echo "=== DEPLOY COMPLETE ==="
echo ""
echo "Run these verification commands:"
echo ""
echo "  curl -s https://workbench.novaisystems.online/robots.txt | head -5"
echo "  curl -s https://workbench.novaisystems.online/sitemap.xml | head -5"
echo "  curl -s https://workbench.novaisystems.online/humans.txt"
echo "  curl -s https://workbench.novaisystems.online/.well-known/security.txt"
echo "  curl -I https://workbench.novaisystems.online/ 2>/dev/null | head -5"
echo ""
echo "robots.txt should show 'User-agent: *' (NOT '<!DOCTYPE html>')"
echo "sitemap.xml should show '<?xml' (NOT '<!DOCTYPE html>')"
