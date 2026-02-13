# AliveTrust — Deployment Guide

## Prerequisites

- Node.js 18+
- Cloudflare account with Workers, D1, KV, and Pages enabled
- Wrangler CLI (`npm install -g wrangler`)
- Authenticated with Cloudflare: `wrangler login`

---

## 1. Database Setup (D1)

### Create the database

```bash
wrangler d1 create alivetrust-db
# Note the database ID from the output — you will need it for wrangler.toml
```

### Apply schema

```bash
cd alivetrust/api
wrangler d1 execute alivetrust-db --file=../schema/schema.sql
```

### Seed verified sources

```bash
wrangler d1 execute alivetrust-db --file=../schema/seed_sources.sql
# Or use the API seed endpoint after deployment
```

### (Optional) Load demo data

```bash
wrangler d1 execute alivetrust-db --file=../schema/seed_demo.sql
```

---

## 2. KV Namespace Setup

### Create sessions namespace

```bash
wrangler kv namespace create SESSIONS
# Note the ID from the output — you will need it for wrangler.toml
```

---

## 3. Environment Variables

### Required secrets

```bash
wrangler secret put JWT_SECRET   # (if using JWT instead of KV sessions)
# No other secrets required for MVP
```

### wrangler.toml configuration

Update these values in `alivetrust/api/wrangler.toml`:

| Key | Description |
|-----|-------------|
| `d1_databases.database_id` | Your D1 database ID from step 1 |
| `kv_namespaces.id` | Your KV namespace ID from step 2 |
| `vars.ALLOWED_ORIGIN` | Your Cloudflare Pages domain (e.g., `https://alivetrust.pages.dev`) |

---

## 4. API Worker Deployment

```bash
cd alivetrust/api
npm install
wrangler deploy
```

Note the worker URL from the output (e.g., `https://alivetrust-api.your-account.workers.dev`). You will need this for the frontend configuration.

---

## 5. Frontend Deployment (Cloudflare Pages)

### Option A: Wrangler Pages

```bash
cd alivetrust/frontend
wrangler pages deploy . --project-name=alivetrust
```

### Option B: Git Integration

1. Connect your GitHub repo to Cloudflare Pages.
2. Set build output directory: `alivetrust/frontend`
3. Set build command: _(none — static files)_

### Configure API URL

Update the `BASE_URL` in `alivetrust/frontend/js/api.js` to point to your worker URL.

Alternatively, set up a custom domain or route so both the API and frontend are on the same origin, which avoids CORS configuration entirely.

---

## 6. Custom Domain Setup (Optional)

### For the API

```bash
wrangler route add "alivetrust-api.novaisystems.online/*" --zone-name=novaisystems.online
```

### For the Frontend

In the Cloudflare Pages dashboard, add a custom domain:

```
alivetrust.novaisystems.online
```

---

## 7. Verification

### Check API health

```bash
curl https://your-worker-url.workers.dev/
```

### Register a test user

```bash
curl -X POST https://your-worker-url.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'
```

### Create a trust

```bash
curl -X POST https://your-worker-url.workers.dev/trust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test Trust","type":"revocable","state":"CA","county":"Los Angeles"}'
```

### Run compute

```bash
curl -X POST https://your-worker-url.workers.dev/trust/TRUST_ID/compute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8. Monitoring & Maintenance

### View worker logs

```bash
wrangler tail alivetrust-api
```

### Database queries

```bash
wrangler d1 execute alivetrust-db --command="SELECT COUNT(*) FROM users"
```

### KV operations

```bash
wrangler kv key list --namespace-id=YOUR_KV_ID
```

---

## Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `D1_ERROR: no such table` | Schema not applied | Run the schema migration in step 1 |
| CORS errors in browser console | `ALLOWED_ORIGIN` mismatch | Verify `ALLOWED_ORIGIN` in `wrangler.toml` matches your Pages domain exactly |
| 401 Unauthorized on API calls | Session expired or missing token | Check that the `Authorization: Bearer` header is sent with every request |
| `KV GET failed` | KV namespace not bound | Verify the KV binding in `wrangler.toml` matches your namespace ID |
| Worker returns 500 | Unhandled error in worker code | Run `wrangler tail` to inspect the error logs |

### Reset Demo Data

```bash
wrangler d1 execute alivetrust-db --command="DELETE FROM audit_log; DELETE FROM computations; DELETE FROM doc_chunks; DELETE FROM evidence; DELETE FROM documents; DELETE FROM assets; DELETE FROM trust_profile; DELETE FROM users;"
```

Then re-seed:

```bash
wrangler d1 execute alivetrust-db --file=../schema/seed_sources.sql
wrangler d1 execute alivetrust-db --file=../schema/seed_demo.sql
```
