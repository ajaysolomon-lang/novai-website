import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

// NBA-style scoring: proximity, rating, experience, tier, availability
const WEIGHTS = {
  zip_match: 30,      // Same ZIP = 30pts
  zip_adjacent: 20,   // Adjacent ZIP = 20pts
  category: 25,       // Category match = 25pts
  rating: 15,         // Up to 15pts based on rating
  experience: 10,     // Up to 10pts based on jobs completed
  tier: 10,           // Up to 10pts based on verification tier
  availability: 10    // Available = 10pts
};

export async function handleMatch(path, method, request, env) {
  if (path === '/run' && method === 'POST') return runMatch(request, env);
  if (path === '/results' && method === 'GET') return getResults(request, env);
  if (path === '/accept' && method === 'POST') return acceptMatch(request, env);
  return error('Match route not found', 404);
}

async function runMatch(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { job_id } = await request.json();
  if (!job_id) return error('job_id required');

  const job = await env.DB.prepare('SELECT * FROM v6_jobs WHERE id = ?').bind(job_id).first();
  if (!job) return error('Job not found', 404);
  if (job.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);

  // Find providers in same category
  const providers = await env.DB.prepare(
    'SELECT * FROM v6_providers WHERE category = ?'
  ).bind(job.category).all();

  if (!providers.results.length) {
    return success({ matches: [], message: 'No providers found for this category' });
  }

  // Score each provider
  const scored = providers.results.map(provider => {
    const breakdown = {};
    let total = 0;

    // ZIP match
    const providerZips = parseJSON(provider.zip_codes, []);
    if (providerZips.includes(job.zip_code)) {
      breakdown.zip = WEIGHTS.zip_match;
    } else if (isAdjacentZip(job.zip_code, providerZips)) {
      breakdown.zip = WEIGHTS.zip_adjacent;
    } else {
      breakdown.zip = 0;
    }
    total += breakdown.zip;

    // Category match (already filtered, so full points)
    breakdown.category = WEIGHTS.category;
    total += breakdown.category;

    // Rating (0-5 scale → 0-15pts)
    breakdown.rating = Math.round((provider.rating / 5) * WEIGHTS.rating);
    total += breakdown.rating;

    // Experience (cap at 50 jobs for full score)
    breakdown.experience = Math.round(Math.min(provider.jobs_completed / 50, 1) * WEIGHTS.experience);
    total += breakdown.experience;

    // Tier bonus
    breakdown.tier = Math.round((provider.verification_tier / 3) * WEIGHTS.tier);
    total += breakdown.tier;

    // Availability
    breakdown.availability = provider.available ? WEIGHTS.availability : 0;
    total += breakdown.availability;

    return { provider_id: provider.id, business_name: provider.business_name, score: total, breakdown };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, 5);

  // Clear old matches and insert new ones
  await env.DB.prepare('DELETE FROM v6_matches WHERE job_id = ?').bind(job_id).run();

  for (const match of topMatches) {
    await env.DB.prepare(
      'INSERT INTO v6_matches (job_id, provider_id, score, breakdown) VALUES (?, ?, ?, ?)'
    ).bind(job_id, match.provider_id, match.score, JSON.stringify(match.breakdown)).run();
  }

  await env.DB.prepare('UPDATE v6_jobs SET status = "matched", updated_at = datetime("now") WHERE id = ?').bind(job_id).run();

  return success({ matches: topMatches, total_providers_scored: scored.length }, 'Matching complete');
}

async function getResults(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const job_id = url.searchParams.get('job_id');
  if (!job_id) return error('job_id query param required');

  const matches = await env.DB.prepare(
    'SELECT m.*, p.business_name, p.rating, p.jobs_completed, p.verification_tier FROM v6_matches m JOIN v6_providers p ON m.provider_id = p.id WHERE m.job_id = ? ORDER BY m.score DESC'
  ).bind(job_id).all();

  return success({ matches: matches.results });
}

async function acceptMatch(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { match_id } = await request.json();
  if (!match_id) return error('match_id required');

  const match = await env.DB.prepare('SELECT m.*, j.user_id FROM v6_matches m JOIN v6_jobs j ON m.job_id = j.id WHERE m.id = ?').bind(match_id).first();
  if (!match) return error('Match not found', 404);
  if (match.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);

  await env.DB.batch([
    env.DB.prepare('UPDATE v6_matches SET status = "accepted" WHERE id = ?').bind(match_id),
    env.DB.prepare('UPDATE v6_matches SET status = "rejected" WHERE job_id = ? AND id != ?').bind(match.job_id, match_id),
    env.DB.prepare('UPDATE v6_jobs SET matched_provider_id = ?, status = "accepted", updated_at = datetime("now") WHERE id = ?').bind(match.provider_id, match.job_id)
  ]);

  return success({ job_id: match.job_id, provider_id: match.provider_id }, 'Match accepted — ready for scheduling');
}

function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function isAdjacentZip(zip, providerZips) {
  const z = parseInt(zip);
  return providerZips.some(pz => Math.abs(parseInt(pz) - z) <= 5);
}
