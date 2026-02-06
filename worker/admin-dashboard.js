// ─── WorkBench Admin Dashboard ──────────────────────────────────────
// Served at /_wb-admin with bearer token auth
// Shows: leads, voice calls, analytics, system status

const ADMIN_TOKENS = ["wb-admin-novai-2025-secure", "novai2025wb"];

export function verifyAdmin(request) {
  const url = new URL(request.url);
  const qKey = url.searchParams.get("key");
  const authHeader = request.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace("Bearer ", "").trim();
  return ADMIN_TOKENS.includes(qKey) || ADMIN_TOKENS.includes(bearerToken);
}

export function handleAdminDashboard(request) {
  if (!verifyAdmin(request)) {
    return new Response("Unauthorized. Access: /_wb-admin?key=YOUR_KEY", {
      status: 401,
      headers: { "Content-Type": "text/plain", "WWW-Authenticate": "Bearer" }
    });
  }
  return new Response(DASHBOARD_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer"
    }
  });
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WorkBench GTM Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }

  .header { background: linear-gradient(135deg, #0a2540, #0f2f52); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 20px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 20px; font-weight: 700; }
  .header h1 span { color: #0077ff; }
  .header-right { display: flex; gap: 12px; align-items: center; }
  .header-status { font-size: 12px; color: #3fb950; display: flex; align-items: center; gap: 6px; }
  .header-status::before { content: ''; width: 8px; height: 8px; background: #3fb950; border-radius: 50%; }
  .refresh-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #e6edf3; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: background 0.15s; }
  .refresh-btn:hover { background: rgba(255,255,255,0.15); }
  .back-btn { background: none; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.6); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; text-decoration: none; transition: all 0.15s; }
  .back-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

  .tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 32px; background: #161b22; }
  .tab { padding: 12px 24px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
  .tab:hover { color: rgba(255,255,255,0.8); }
  .tab.active { color: #0077ff; border-bottom-color: #0077ff; }

  .content { padding: 24px 32px; max-width: 1200px; }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: #161b22; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; }
  .stat-label { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 28px; font-weight: 700; margin-top: 8px; }
  .stat-value.blue { color: #0077ff; }
  .stat-value.green { color: #3fb950; }
  .stat-value.amber { color: #f59e0b; }
  .stat-value.red { color: #ef4444; }

  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
  thead { background: #1c2333; }
  th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 12px 16px; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); }
  tr:hover td { background: rgba(255,255,255,0.02); }

  .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: rgba(0,119,255,0.15); color: #58a6ff; }
  .badge-green { background: rgba(63,185,80,0.15); color: #3fb950; }
  .badge-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge-red { background: rgba(239,68,68,0.15); color: #ef4444; }

  .empty-state { text-align: center; padding: 48px; color: rgba(255,255,255,0.3); }
  .empty-state p { font-size: 14px; margin-top: 8px; }

  .loading { text-align: center; padding: 48px; color: rgba(255,255,255,0.4); }

  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-title .count { font-size: 12px; background: rgba(0,119,255,0.15); color: #58a6ff; padding: 2px 8px; border-radius: 10px; }

  .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  .alert-info { background: rgba(0,119,255,0.1); border: 1px solid rgba(0,119,255,0.2); color: #58a6ff; }
  .alert-warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #f59e0b; }

  @media (max-width: 768px) {
    .content { padding: 16px; }
    .header { padding: 16px; flex-wrap: wrap; gap: 8px; }
    .tabs { padding: 0 16px; overflow-x: auto; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    table { font-size: 12px; }
    th, td { padding: 8px 10px; }
  }
</style>
</head>
<body>

<div class="header">
  <h1><span>WorkBench</span> GTM Dashboard</h1>
  <div class="header-right">
    <div class="header-status" id="status">Checking...</div>
    <a href="/admin" class="back-btn">Back to Admin</a>
    <button class="refresh-btn" onclick="loadAll()">Refresh</button>
  </div>
</div>

<div class="tabs">
  <div class="tab active" data-tab="overview" onclick="switchTab('overview')">Overview</div>
  <div class="tab" data-tab="leads" onclick="switchTab('leads')">Leads</div>
  <div class="tab" data-tab="calls" onclick="switchTab('calls')">Voice Calls</div>
  <div class="tab" data-tab="analytics" onclick="switchTab('analytics')">Analytics</div>
</div>

<div class="content" id="content">
  <div class="loading">Loading dashboard...</div>
</div>

<script>
var API_KEY = new URLSearchParams(window.location.search).get('key') || '';
var BASE = window.location.origin;
var data = { leads: [], calls: [], analytics: {}, reports: [] };

function api(path) {
  var sep = path.includes('?') ? '&' : '?';
  return fetch(BASE + path + sep + 'key=' + encodeURIComponent(API_KEY), {
    headers: { 'Authorization': 'Bearer ' + API_KEY }
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .catch(function(e) {
    console.error('API error:', path, e);
    return null;
  });
}

function loadAll() {
  document.getElementById('content').innerHTML = '<div class="loading">Loading dashboard...</div>';
  Promise.all([
    api('/_wb-leads?limit=100'),
    api('/_wb-voice/calls'),
    api('/_wb-voice/analytics')
  ]).then(function(results) {
    var leadsRes = results[0] || {};
    var callsRes = results[1] || {};
    var analyticsRes = results[2] || {};

    data.leads = leadsRes.leads || [];
    data.totalLeads = leadsRes.total || data.leads.length;
    data.calls = callsRes.calls || [];
    data.totalCalls = callsRes.total || data.calls.length;
    data.reports = analyticsRes.recent_reports || [];

    // Convert daily array to date-keyed object
    data.dailyAnalytics = {};
    var dailyArr = analyticsRes.daily || [];
    if (Array.isArray(dailyArr)) {
      dailyArr.forEach(function(d) { if (d && d.date) data.dailyAnalytics[d.date] = d; });
    } else if (typeof dailyArr === 'object') {
      data.dailyAnalytics = dailyArr;
    }
    data.totals = analyticsRes.totals || {};
    data.kvConfigured = leadsRes.note !== 'KV not configured';

    // Update status
    var statusEl = document.getElementById('status');
    if (data.kvConfigured) {
      statusEl.textContent = 'KV Online';
      statusEl.style.color = '#3fb950';
    } else {
      statusEl.textContent = 'KV Offline';
      statusEl.style.color = '#f59e0b';
    }

    render();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  render(tab);
}

function getActiveTab() {
  var el = document.querySelector('.tab.active');
  return el ? el.getAttribute('data-tab') : 'overview';
}

function render(tab) {
  tab = tab || getActiveTab();
  var el = document.getElementById('content');
  switch(tab) {
    case 'overview': el.innerHTML = renderOverview(); break;
    case 'leads': el.innerHTML = renderLeads(); break;
    case 'calls': el.innerHTML = renderCalls(); break;
    case 'analytics': el.innerHTML = renderAnalytics(); break;
  }
}

function renderOverview() {
  var html = '';
  if (!data.kvConfigured) {
    html += '<div class="alert alert-warn">KV storage is not configured. Data shown may be incomplete.</div>';
  }
  var webLeads = data.leads.filter(function(l) { return !l.source || l.source.indexOf('vapi') === -1; }).length;
  var voiceLeads = data.leads.filter(function(l) { return l.source && l.source.indexOf('vapi') !== -1; }).length;
  html += '<div class="stats-grid">' +
    stat('Total Leads', data.totalLeads || 0, 'blue') +
    stat('Web Chat Leads', webLeads, 'green') +
    stat('Voice Leads', voiceLeads, 'amber') +
    stat('Voice Calls', data.totalCalls || 0, 'blue') +
    stat('Call Reports', data.reports.length, 'green') +
    '</div>';
  html += '<div class="section-title">Recent Leads <span class="count">' + data.leads.length + '</span></div>';
  html += renderLeadTable(data.leads.slice(0, 10));
  html += '<br><div class="section-title">Recent Call Reports <span class="count">' + data.reports.length + '</span></div>';
  html += renderReportTable(data.reports.slice(0, 10));
  return html;
}

function renderLeads() {
  return '<div class="section-title">All Leads <span class="count">' + data.totalLeads + '</span></div>' +
    renderLeadTable(data.leads);
}

function renderCalls() {
  var html = '<div class="section-title">Call Status Log <span class="count">' + data.totalCalls + '</span></div>';
  html += renderCallTable(data.calls);
  html += '<br><div class="section-title">Full Call Reports <span class="count">' + data.reports.length + '</span></div>';
  html += renderReportTable(data.reports);
  return html;
}

function renderAnalytics() {
  var t = data.totals || {};
  var days = Object.keys(data.dailyAnalytics).sort().reverse();

  var html = '<div class="stats-grid">';
  html += stat('Total Calls', t.total_calls || 0, 'blue');
  html += stat('Total Leads', t.total_leads || 0, 'green');
  html += stat('Avg Score', t.avg_success_score || '-', 'amber');
  html += stat('Total Duration', fmtDuration(t.total_duration || 0), 'blue');
  html += '</div>';

  // Intent breakdown
  if (t.intents && Object.keys(t.intents).length > 0) {
    html += '<div class="section-title">Intent Breakdown</div>';
    html += '<div class="stats-grid">';
    Object.keys(t.intents).forEach(function(k) {
      html += stat(k.replace(/_/g, ' '), t.intents[k], 'blue');
    });
    html += '</div>';
  }

  // Outcome breakdown
  if (t.outcomes && Object.keys(t.outcomes).length > 0) {
    html += '<div class="section-title">Outcome Breakdown</div>';
    html += '<div class="stats-grid">';
    Object.keys(t.outcomes).forEach(function(k) {
      var color = k.indexOf('lead') !== -1 || k.indexOf('signup') !== -1 ? 'green' : k.indexOf('lost') !== -1 ? 'red' : 'amber';
      html += stat(k.replace(/_/g, ' '), t.outcomes[k], color);
    });
    html += '</div>';
  }

  // Daily table
  if (days.length > 0) {
    html += '<div class="section-title">Daily Breakdown</div>';
    html += '<table><thead><tr><th>Date</th><th>Calls</th><th>Leads</th><th>Top Intent</th><th>Avg Duration</th></tr></thead><tbody>';
    days.forEach(function(day) {
      var d = data.dailyAnalytics[day];
      var topIntent = '-';
      if (d.intents) {
        var maxI = 0;
        Object.keys(d.intents).forEach(function(k) { if (d.intents[k] > maxI) { maxI = d.intents[k]; topIntent = k; } });
      }
      html += '<tr><td>' + day + '</td><td>' + (d.total_calls || 0) + '</td><td>' + (d.leads_captured || 0) + '</td>';
      html += '<td><span class="badge badge-blue">' + topIntent.replace(/_/g, ' ') + '</span></td>';
      html += '<td>' + fmtDuration(d.total_duration / (d.total_calls || 1)) + '</td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="empty-state"><p>No analytics data yet. Call the AI agent at +1 (943) 223-9707 to generate data.</p></div>';
  }

  return html;
}

function stat(label, value, color) {
  return '<div class="stat-card"><div class="stat-label">' + esc(label) + '</div><div class="stat-value ' + color + '">' + value + '</div></div>';
}

function fmtDuration(s) {
  s = Math.round(s || 0);
  if (s < 60) return s + 's';
  return Math.floor(s/60) + 'm ' + (s%60) + 's';
}

function renderLeadTable(leads) {
  if (!leads || leads.length === 0) return '<div class="empty-state"><p>No leads yet. Leads appear from chat forms and voice calls.</p></div>';
  var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Need</th><th>Source</th><th>Date</th></tr></thead><tbody>';
  leads.forEach(function(l) {
    var src = (l.source || '').indexOf('vapi') !== -1 ? '<span class="badge badge-amber">Voice</span>' : '<span class="badge badge-blue">Web</span>';
    var dt = fmtDate(l.timestamp || l.created);
    html += '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.email) + '</td><td>' + esc(l.phone) + '</td>';
    html += '<td>' + esc(l.need || l.product) + '</td><td>' + src + '</td><td>' + dt + '</td></tr>';
  });
  return html + '</tbody></table>';
}

function renderCallTable(calls) {
  if (!calls || calls.length === 0) return '<div class="empty-state"><p>No status logs yet.</p></div>';
  var html = '<table><thead><tr><th>Caller</th><th>Status</th><th>Duration</th><th>Date</th></tr></thead><tbody>';
  calls.forEach(function(c) {
    var st = c.status === 'ended' ? '<span class="badge badge-green">Ended</span>' : '<span class="badge badge-amber">' + esc(c.status) + '</span>';
    html += '<tr><td>' + esc(c.customer_number) + '</td><td>' + st + '</td>';
    html += '<td>' + fmtDuration(c.duration) + '</td><td>' + fmtDate(c.created) + '</td></tr>';
  });
  return html + '</tbody></table>';
}

function renderReportTable(reports) {
  if (!reports || reports.length === 0) return '<div class="empty-state"><p>No call reports yet. Reports appear after calls complete.</p></div>';
  var html = '<table><thead><tr><th>Caller</th><th>Intent</th><th>Outcome</th><th>Sentiment</th><th>Score</th><th>Duration</th><th>Summary</th><th>Date</th></tr></thead><tbody>';
  reports.forEach(function(r) {
    var intent = '<span class="badge badge-blue">' + esc(r.caller_intent || r.structured_data && r.structured_data.caller_intent) + '</span>';
    var outcome = esc(r.outcome || (r.structured_data && r.structured_data.outcome));
    var sentiment = r.sentiment || (r.structured_data && r.structured_data.sentiment) || '-';
    var sentColor = sentiment === 'positive' ? 'badge-green' : sentiment === 'negative' ? 'badge-red' : 'badge-amber';
    var score = r.success_score || '-';
    var scoreColor = score >= 7 ? 'badge-green' : score >= 4 ? 'badge-amber' : score > 0 ? 'badge-red' : 'badge-blue';
    var summary = (r.summary || '').substring(0, 80);
    if (r.summary && r.summary.length > 80) summary += '...';
    html += '<tr><td>' + esc(r.customer_number) + '</td><td>' + intent + '</td><td>' + outcome + '</td>';
    html += '<td><span class="badge ' + sentColor + '">' + sentiment + '</span></td>';
    html += '<td><span class="badge ' + scoreColor + '">' + score + '</span></td>';
    html += '<td>' + fmtDuration(r.duration) + '</td>';
    html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc(summary) + '</td>';
    html += '<td>' + fmtDate(r.created) + '</td></tr>';
  });
  return html + '</tbody></table>';
}

function fmtDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString(); } catch(e) { return d; }
}

function esc(s) {
  if (!s) return '-';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

loadAll();
</script>
</body>
</html>`;
