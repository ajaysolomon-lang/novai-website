import { api, login, register, logout, getToken, getUser, setUser } from './utils/api.js';

// ─── Router ───
function navigate(hash) {
  const page = hash.replace('#', '') || 'login';
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const token = getToken();
  const publicPages = ['login', 'register'];

  if (!token && !publicPages.includes(page)) {
    window.location.hash = '#login';
    return;
  }
  if (token && publicPages.includes(page)) {
    window.location.hash = '#dashboard';
    return;
  }

  const el = document.getElementById(`page-${page}`);
  if (el) {
    el.classList.remove('hidden');
    document.querySelector(`a[href="#${page}"]`)?.classList.add('active');
  }

  const header = document.getElementById('header');
  if (token) { header.classList.remove('hidden'); } else { header.classList.add('hidden'); }

  // Page-specific init
  if (page === 'dashboard') loadDashboard();
  if (page === 'jobs') loadJobs();
  if (page === 'search') { /* ready */ }
  if (page === 'schedule') loadSchedules();
  if (page === 'settings') loadSettings();
}

window.addEventListener('hashchange', () => navigate(window.location.hash));
window.addEventListener('load', () => navigate(window.location.hash || '#login'));

// ─── Auth ───
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    await login(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
    window.location.hash = '#dashboard';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  try {
    await register(
      document.getElementById('reg-email').value,
      document.getElementById('reg-password').value,
      document.getElementById('reg-name').value,
      document.getElementById('reg-phone').value
    );
    window.location.hash = '#dashboard';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

// ─── Dashboard ───
async function loadDashboard() {
  try {
    const user = getUser();
    const tier = await api('/api/verify/tier');
    document.getElementById('stat-tier').textContent = tier.tier;

    // Verification banner
    const banner = document.getElementById('verification-banner');
    if (!tier.email_verified) {
      banner.classList.remove('hidden');
      document.getElementById('verification-msg').textContent = 'Verify your email to unlock full features';
    } else {
      banner.classList.add('hidden');
    }

    // Job stats
    const openJobs = await api('/api/intake/jobs?status=open');
    const matchedJobs = await api('/api/intake/jobs?status=matched');
    const scheduledJobs = await api('/api/intake/jobs?status=scheduled');
    document.getElementById('stat-jobs').textContent = openJobs.jobs?.length || 0;
    document.getElementById('stat-matched').textContent = matchedJobs.jobs?.length || 0;
    document.getElementById('stat-scheduled').textContent = scheduledJobs.jobs?.length || 0;

    // Recent jobs
    const recentEl = document.getElementById('recent-jobs');
    const allJobs = [...(openJobs.jobs || []), ...(matchedJobs.jobs || [])].slice(0, 5);
    recentEl.innerHTML = allJobs.length ? allJobs.map(j => jobItem(j)).join('') : '<p style="color:var(--text-muted)">No active jobs</p>';
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ─── Jobs ───
document.getElementById('new-job-btn').addEventListener('click', () => {
  document.getElementById('job-form-section').classList.toggle('hidden');
});

document.getElementById('job-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/intake/job', {
      method: 'POST',
      body: JSON.stringify({
        title: document.getElementById('job-title').value,
        description: document.getElementById('job-desc').value,
        category: document.getElementById('job-category').value,
        zip_code: document.getElementById('job-zip').value,
        budget_min: parseFloat(document.getElementById('job-budget-min').value) || null,
        budget_max: parseFloat(document.getElementById('job-budget-max').value) || null,
        urgency: document.getElementById('job-urgency').value
      })
    });
    document.getElementById('job-form').reset();
    document.getElementById('job-form-section').classList.add('hidden');
    loadJobs();
  } catch (err) {
    alert(err.message);
  }
});

async function loadJobs() {
  try {
    const data = await api('/api/intake/jobs?status=open');
    const matched = await api('/api/intake/jobs?status=matched');
    const scheduled = await api('/api/intake/jobs?status=scheduled');
    const all = [...(data.jobs || []), ...(matched.jobs || []), ...(scheduled.jobs || [])];

    const listEl = document.getElementById('jobs-list');
    listEl.innerHTML = all.length ? all.map(j => jobItem(j)).join('') : '<p style="color:var(--text-muted)">No jobs yet. Create one above.</p>';

    // Click handler for job detail
    listEl.querySelectorAll('.list-item').forEach(el => {
      el.addEventListener('click', () => loadJobDetail(el.dataset.id));
    });
  } catch (err) {
    console.error('Jobs load error:', err);
  }
}

async function loadJobDetail(jobId) {
  try {
    const data = await api(`/api/intake/job/${jobId}`);
    const detailEl = document.getElementById('job-detail');
    detailEl.classList.remove('hidden');

    let html = `<h3>${data.job.title}</h3>
      <p>${data.job.description}</p>
      <p><strong>Category:</strong> ${data.job.category} | <strong>ZIP:</strong> ${data.job.zip_code} | <strong>Status:</strong> ${data.job.status}</p>`;

    if (data.job.status === 'open') {
      html += `<button class="btn btn-primary" onclick="runMatch(${jobId})">Run Match Agent</button>`;
    }

    if (data.matches?.length) {
      html += '<h4 style="margin-top:16px">Matches</h4>';
      data.matches.forEach(m => {
        const breakdown = typeof m.breakdown === 'string' ? JSON.parse(m.breakdown) : m.breakdown;
        html += `<div class="match-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${m.business_name}</strong>
              <p class="meta">Rating: ${m.rating} | Jobs: ${m.jobs_completed}</p>
            </div>
            <div class="score">${m.score}</div>
          </div>
          ${m.status === 'pending' ? `<button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="acceptMatch(${m.id})">Accept</button>` : `<span class="status status-${m.status}">${m.status}</span>`}
        </div>`;
      });
    }

    if (data.job.status === 'accepted' && !data.schedule) {
      html += `<div style="margin-top:16px">
        <h4>Schedule Appointment</h4>
        <input type="date" id="sched-date">
        <input type="time" id="sched-time">
        <button class="btn btn-primary" onclick="bookSchedule(${jobId})">Book</button>
      </div>`;
    }

    if (data.schedule) {
      html += `<div class="match-card" style="margin-top:16px">
        <strong>Scheduled:</strong> ${data.schedule.scheduled_date} at ${data.schedule.scheduled_time}
        <span class="status status-${data.schedule.status}">${data.schedule.status}</span>
      </div>`;
    }

    detailEl.innerHTML = html;
  } catch (err) {
    console.error('Job detail error:', err);
  }
}

// Global functions for inline onclick
window.runMatch = async function(jobId) {
  try {
    const data = await api('/api/match/run', { method: 'POST', body: JSON.stringify({ job_id: jobId }) });
    alert(`Matching complete! ${data.matches?.length || 0} providers scored.`);
    loadJobDetail(jobId);
  } catch (err) { alert(err.message); }
};

window.acceptMatch = async function(matchId) {
  try {
    await api('/api/match/accept', { method: 'POST', body: JSON.stringify({ match_id: matchId }) });
    alert('Match accepted! You can now schedule.');
    loadJobs();
  } catch (err) { alert(err.message); }
};

window.bookSchedule = async function(jobId) {
  try {
    const date = document.getElementById('sched-date').value;
    const time = document.getElementById('sched-time').value;
    if (!date || !time) { alert('Select date and time'); return; }
    await api('/api/schedule/book', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, scheduled_date: date, scheduled_time: time })
    });
    alert('Appointment booked!');
    loadJobDetail(jobId);
  } catch (err) { alert(err.message); }
};

// ─── Search ───
document.getElementById('search-btn').addEventListener('click', async () => {
  const q = document.getElementById('search-input').value;
  const category = document.getElementById('search-category').value;
  const zip = document.getElementById('search-zip').value;

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (zip) params.set('zip', zip);

    const data = await api(`/api/search/providers?${params}`);
    const resultsEl = document.getElementById('search-results');

    resultsEl.innerHTML = data.providers?.length
      ? data.providers.map(p => `<div class="list-item">
          <div>
            <div class="title">${p.business_name}</div>
            <div class="meta">${p.category} | Rating: ${p.rating} | Jobs: ${p.jobs_completed} | Tier ${p.verification_tier}</div>
          </div>
          <div class="score" style="font-size:1.2rem;color:var(--accent);font-weight:700">${p.relevance_score}</div>
        </div>`).join('')
      : '<p style="color:var(--text-muted)">No results found</p>';
  } catch (err) {
    alert(err.message);
  }
});

// ─── Schedules ───
async function loadSchedules() {
  try {
    const data = await api('/api/schedule/list');
    const listEl = document.getElementById('schedules-list');
    listEl.innerHTML = data.schedules?.length
      ? data.schedules.map(s => `<div class="list-item">
          <div>
            <div class="title">${s.title}</div>
            <div class="meta">${s.business_name} | ${s.scheduled_date} at ${s.scheduled_time}</div>
          </div>
          <span class="status status-${s.status}">${s.status}</span>
        </div>`).join('')
      : '<p style="color:var(--text-muted)">No schedules yet</p>';
  } catch (err) {
    console.error('Schedule load error:', err);
  }
}

// ─── Settings ───
async function loadSettings() {
  const user = getUser();
  if (!user) return;

  document.getElementById('account-info').innerHTML = `
    <p><strong>Name:</strong> ${user.name}</p>
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Role:</strong> ${user.role}</p>
    <p><strong>Status:</strong> ${user.status}</p>`;

  try {
    const tier = await api('/api/verify/tier');

    document.getElementById('email-verify-section').innerHTML = tier.email_verified
      ? '<p class="success-msg">Email verified</p>'
      : `<p>Enter the code sent to your email:</p>
         <input type="text" id="email-code" placeholder="Verification Code">
         <button class="btn btn-primary" id="verify-email-submit">Verify</button>
         <button class="btn btn-sm" id="resend-email">Resend Code</button>
         <div id="email-verify-msg"></div>`;

    document.getElementById('phone-verify-section').innerHTML = tier.phone_verified
      ? '<p class="success-msg">Phone verified</p>'
      : `<input type="tel" id="phone-number" placeholder="Phone Number">
         <button class="btn btn-sm" id="send-phone-code">Send Code</button>
         <input type="text" id="phone-code" placeholder="Enter Code" style="margin-top:8px">
         <button class="btn btn-primary" id="verify-phone-submit">Verify Phone</button>
         <div id="phone-verify-msg"></div>`;

    // Bind verification handlers
    document.getElementById('verify-email-submit')?.addEventListener('click', async () => {
      try {
        await api('/api/verify/email', { method: 'POST', body: JSON.stringify({ code: document.getElementById('email-code').value }) });
        alert('Email verified!');
        const me = await api('/api/auth/me');
        setUser(me.user);
        loadSettings();
      } catch (err) { document.getElementById('email-verify-msg').textContent = err.message; }
    });

    document.getElementById('resend-email')?.addEventListener('click', async () => {
      try {
        const data = await api('/api/verify/email/resend', { method: 'POST' });
        alert('Code sent! Dev code: ' + (data.verification_code_dev || 'check logs'));
      } catch (err) { alert(err.message); }
    });

    document.getElementById('send-phone-code')?.addEventListener('click', async () => {
      try {
        const data = await api('/api/verify/phone/send', { method: 'POST', body: JSON.stringify({ phone: document.getElementById('phone-number').value }) });
        alert('Phone code sent! Dev code: ' + (data.verification_code_dev || 'check logs'));
      } catch (err) { alert(err.message); }
    });

    document.getElementById('verify-phone-submit')?.addEventListener('click', async () => {
      try {
        await api('/api/verify/phone', { method: 'POST', body: JSON.stringify({ code: document.getElementById('phone-code').value }) });
        alert('Phone verified!');
        const me = await api('/api/auth/me');
        setUser(me.user);
        loadSettings();
      } catch (err) { document.getElementById('phone-verify-msg').textContent = err.message; }
    });
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

// Provider registration
document.getElementById('provider-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('provider-msg');
  try {
    await api('/api/intake/provider', {
      method: 'POST',
      body: JSON.stringify({
        business_name: document.getElementById('prov-name').value,
        category: document.getElementById('prov-category').value,
        services: document.getElementById('prov-services').value.split(',').map(s => s.trim()),
        zip_codes: document.getElementById('prov-zips').value.split(',').map(s => s.trim())
      })
    });
    msgEl.textContent = 'Provider registered!';
    msgEl.className = 'success-msg';
    msgEl.classList.remove('hidden');
    document.getElementById('provider-form').reset();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'error-msg';
    msgEl.classList.remove('hidden');
  }
});

// Email verify banner button
document.getElementById('verify-email-btn').addEventListener('click', () => {
  window.location.hash = '#settings';
});

// ─── Helpers ───
function jobItem(job) {
  return `<div class="list-item" data-id="${job.id}">
    <div>
      <div class="title">${job.title}</div>
      <div class="meta">${job.category} | ${job.zip_code} | ${job.urgency}</div>
    </div>
    <span class="status status-${job.status}">${job.status}</span>
  </div>`;
}
