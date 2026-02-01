import { json, error, success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

export async function handleSchedule(path, method, request, env) {
  if (path === '/book' && method === 'POST') return bookSchedule(request, env);
  if (path === '/list' && method === 'GET') return listSchedules(request, env);
  if (path === '/cancel' && method === 'POST') return cancelSchedule(request, env);
  if (path === '/reschedule' && method === 'POST') return reschedule(request, env);
  return error('Schedule route not found', 404);
}

async function bookSchedule(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { job_id, scheduled_date, scheduled_time, notes } = await request.json();
  if (!job_id || !scheduled_date || !scheduled_time) {
    return error('job_id, scheduled_date, and scheduled_time are required');
  }

  // Validate date is in the future
  const schedDate = new Date(`${scheduled_date}T${scheduled_time}`);
  if (schedDate <= new Date()) {
    return error('Scheduled date must be in the future');
  }

  const job = await env.DB.prepare('SELECT * FROM v6_jobs WHERE id = ?').bind(job_id).first();
  if (!job) return error('Job not found', 404);
  if (job.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);
  if (!job.matched_provider_id) return error('Job has no accepted provider. Run matching first.');

  // Check provider availability for that slot
  const conflict = await env.DB.prepare(
    'SELECT id FROM v6_schedules WHERE provider_id = ? AND scheduled_date = ? AND scheduled_time = ? AND status != "cancelled"'
  ).bind(job.matched_provider_id, scheduled_date, scheduled_time).first();

  if (conflict) return error('Provider already booked at this time');

  const result = await env.DB.prepare(
    'INSERT INTO v6_schedules (job_id, provider_id, user_id, scheduled_date, scheduled_time, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(job_id, job.matched_provider_id, auth.user.id, scheduled_date, scheduled_time, notes || null).run();

  await env.DB.prepare('UPDATE v6_jobs SET scheduled_at = ?, status = "scheduled", updated_at = datetime("now") WHERE id = ?')
    .bind(`${scheduled_date} ${scheduled_time}`, job_id).run();

  return success({
    schedule_id: result.meta.last_row_id,
    job_id, provider_id: job.matched_provider_id,
    date: scheduled_date, time: scheduled_time
  }, 'Appointment booked');
}

async function listSchedules(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'confirmed';

  let schedules;
  if (auth.user.role === 'admin') {
    schedules = await env.DB.prepare(
      'SELECT s.*, j.title, j.category, p.business_name FROM v6_schedules s JOIN v6_jobs j ON s.job_id = j.id JOIN v6_providers p ON s.provider_id = p.id WHERE s.status = ? ORDER BY s.scheduled_date, s.scheduled_time'
    ).bind(status).all();
  } else {
    schedules = await env.DB.prepare(
      'SELECT s.*, j.title, j.category, p.business_name FROM v6_schedules s JOIN v6_jobs j ON s.job_id = j.id JOIN v6_providers p ON s.provider_id = p.id WHERE s.user_id = ? AND s.status = ? ORDER BY s.scheduled_date, s.scheduled_time'
    ).bind(auth.user.id, status).all();
  }

  return success({ schedules: schedules.results, count: schedules.results.length });
}

async function cancelSchedule(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { schedule_id } = await request.json();
  if (!schedule_id) return error('schedule_id required');

  const schedule = await env.DB.prepare('SELECT * FROM v6_schedules WHERE id = ?').bind(schedule_id).first();
  if (!schedule) return error('Schedule not found', 404);
  if (schedule.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);

  await env.DB.batch([
    env.DB.prepare('UPDATE v6_schedules SET status = "cancelled" WHERE id = ?').bind(schedule_id),
    env.DB.prepare('UPDATE v6_jobs SET status = "matched", scheduled_at = NULL, updated_at = datetime("now") WHERE id = ?').bind(schedule.job_id)
  ]);

  return success({}, 'Schedule cancelled');
}

async function reschedule(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { schedule_id, scheduled_date, scheduled_time } = await request.json();
  if (!schedule_id || !scheduled_date || !scheduled_time) {
    return error('schedule_id, scheduled_date, and scheduled_time required');
  }

  const schedule = await env.DB.prepare('SELECT * FROM v6_schedules WHERE id = ?').bind(schedule_id).first();
  if (!schedule) return error('Schedule not found', 404);
  if (schedule.user_id !== auth.user.id && auth.user.role !== 'admin') return error('Access denied', 403);

  await env.DB.batch([
    env.DB.prepare('UPDATE v6_schedules SET scheduled_date = ?, scheduled_time = ? WHERE id = ?').bind(scheduled_date, scheduled_time, schedule_id),
    env.DB.prepare('UPDATE v6_jobs SET scheduled_at = ?, updated_at = datetime("now") WHERE id = ?').bind(`${scheduled_date} ${scheduled_time}`, schedule.job_id)
  ]);

  return success({ schedule_id, date: scheduled_date, time: scheduled_time }, 'Rescheduled');
}
