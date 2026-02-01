import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const VALID_CATEGORIES = [
  'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping',
  'cleaning', 'painting', 'moving', 'pest-control', 'handyman',
  'auto-repair', 'tutoring', 'consulting', 'design', 'development'
];

export async function handleIntake(path, method, request, env) {
  if (path === '/job' && method === 'POST') return createJob(request, env);
  if (path === '/jobs' && method === 'GET') return listJobs(request, env);
  if (path.startsWith('/job/') && method === 'GET') return getJob(path, request, env);
  if (path === '/provider' && method === 'POST') return registerProvider(request, env);
  return error('Intake route not found', 404);
}

async function createJob(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.verification_tier < 1) return error('Email verification required to create jobs', 403);

  const { title, description, category, zip_code, budget_min, budget_max, urgency } = await request.json();

  if (!title || !description || !category || !zip_code) {
    return error('Title, description, category, and zip_code are required');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return error(`Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (!/^\d{5}$/.test(zip_code)) {
    return error('Invalid ZIP code format (5 digits required)');
  }

  const result = await env.DB.prepare(
    'INSERT INTO v6_jobs (user_id, title, description, category, zip_code, budget_min, budget_max, urgency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(auth.user.id, title, description, category, zip_code, budget_min || null, budget_max || null, urgency || 'normal').run();

  return success({ job_id: result.meta.last_row_id }, 'Job created — ready for matching');
}

async function listJobs(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'open';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  let jobs;
  if (auth.user.role === 'admin') {
    jobs = await env.DB.prepare('SELECT * FROM v6_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit).all();
  } else {
    jobs = await env.DB.prepare('SELECT * FROM v6_jobs WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?').bind(auth.user.id, status, limit).all();
  }

  return success({ jobs: jobs.results, count: jobs.results.length });
}

async function getJob(path, request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const jobId = parseInt(path.split('/')[2]);
  const job = await env.DB.prepare('SELECT * FROM v6_jobs WHERE id = ?').bind(jobId).first();
  if (!job) return error('Job not found', 404);
  if (job.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);

  const matches = await env.DB.prepare(
    'SELECT m.*, p.business_name, p.rating, p.jobs_completed FROM v6_matches m JOIN v6_providers p ON m.provider_id = p.id WHERE m.job_id = ? ORDER BY m.score DESC'
  ).bind(jobId).all();

  const schedule = await env.DB.prepare('SELECT * FROM v6_schedules WHERE job_id = ?').bind(jobId).first();

  return success({ job, matches: matches.results, schedule });
}

async function registerProvider(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.verification_tier < 2) return error('Phone verification required to register as provider', 403);

  const { business_name, category, services, zip_codes } = await request.json();

  if (!business_name || !category || !services || !zip_codes) {
    return error('business_name, category, services, and zip_codes are required');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return error(`Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}`);
  }

  const servicesStr = Array.isArray(services) ? JSON.stringify(services) : services;
  const zipStr = Array.isArray(zip_codes) ? JSON.stringify(zip_codes) : zip_codes;

  const result = await env.DB.prepare(
    'INSERT INTO v6_providers (user_id, business_name, category, services, zip_codes, verification_tier) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(auth.user.id, business_name, category, servicesStr, zipStr, auth.user.verification_tier).run();

  return success({ provider_id: result.meta.last_row_id }, 'Provider registered');
}
