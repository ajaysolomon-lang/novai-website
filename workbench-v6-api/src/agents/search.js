import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

export async function handleSearch(path, method, request, env) {
  if (path === '/providers' && method === 'GET') return searchProviders(request, env);
  if (path === '/jobs' && method === 'GET') return searchJobs(request, env);
  if (path === '/suggest' && method === 'GET') return suggest(request, env);
  return error('Search route not found', 404);
}

// RAG-style search: query → decompose → search → rank → return
async function searchProviders(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category');
  const zip = url.searchParams.get('zip');
  const min_rating = parseFloat(url.searchParams.get('min_rating') || '0');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  // Decompose query into search tokens
  const tokens = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  let query = 'SELECT p.*, u.name as owner_name, u.email as owner_email FROM v6_providers p JOIN v6_users u ON p.user_id = u.id WHERE p.available = 1';
  const binds = [];

  if (category) {
    query += ' AND p.category = ?';
    binds.push(category);
  }
  if (min_rating > 0) {
    query += ' AND p.rating >= ?';
    binds.push(min_rating);
  }

  query += ' ORDER BY p.rating DESC, p.jobs_completed DESC LIMIT ?';
  binds.push(limit);

  const stmt = env.DB.prepare(query);
  const results = await (binds.length ? stmt.bind(...binds) : stmt).all();

  // RAG-style re-ranking with token matching
  let ranked = results.results.map(provider => {
    let relevance = 0;
    const searchable = `${provider.business_name} ${provider.category} ${provider.services}`.toLowerCase();

    for (const token of tokens) {
      if (searchable.includes(token)) relevance += 10;
    }

    // ZIP proximity boost
    if (zip) {
      const providerZips = parseJSON(provider.zip_codes, []);
      if (providerZips.includes(zip)) relevance += 20;
      else if (providerZips.some(pz => Math.abs(parseInt(pz) - parseInt(zip)) <= 5)) relevance += 10;
    }

    // Rating boost
    relevance += provider.rating * 2;

    return { ...provider, relevance_score: relevance };
  });

  // Sort by relevance if query provided
  if (tokens.length > 0 || zip) {
    ranked.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  return success({ providers: ranked, count: ranked.length, query: q });
}

async function searchJobs(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category');
  const zip = url.searchParams.get('zip');
  const status = url.searchParams.get('status') || 'open';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  let query = 'SELECT j.*, u.name as requester_name FROM v6_jobs j JOIN v6_users u ON j.user_id = u.id WHERE j.status = ?';
  const binds = [status];

  if (category) { query += ' AND j.category = ?'; binds.push(category); }
  if (zip) { query += ' AND j.zip_code = ?'; binds.push(zip); }

  query += ' ORDER BY j.created_at DESC LIMIT ?';
  binds.push(limit);

  const results = await env.DB.prepare(query).bind(...binds).all();

  // Token-based relevance scoring
  const tokens = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let ranked = results.results.map(job => {
    let relevance = 0;
    const searchable = `${job.title} ${job.description} ${job.category}`.toLowerCase();
    for (const token of tokens) {
      if (searchable.includes(token)) relevance += 10;
    }
    return { ...job, relevance_score: relevance };
  });

  if (tokens.length > 0) {
    ranked.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  return success({ jobs: ranked, count: ranked.length, query: q });
}

async function suggest(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  if (q.length < 2) return success({ suggestions: [] });

  // Get category suggestions
  const categories = [
    'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping',
    'cleaning', 'painting', 'moving', 'pest-control', 'handyman',
    'auto-repair', 'tutoring', 'consulting', 'design', 'development'
  ].filter(c => c.includes(q.toLowerCase()));

  // Get provider name suggestions
  const providers = await env.DB.prepare(
    "SELECT DISTINCT business_name FROM v6_providers WHERE LOWER(business_name) LIKE ? LIMIT 5"
  ).bind(`%${q.toLowerCase()}%`).all();

  return success({
    suggestions: [
      ...categories.map(c => ({ type: 'category', value: c })),
      ...providers.results.map(p => ({ type: 'provider', value: p.business_name }))
    ]
  });
}

function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
