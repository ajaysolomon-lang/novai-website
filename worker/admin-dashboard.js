// ─── WorkBench Admin Dashboard ──────────────────────────────────────
// Served at /_wb-admin with bearer token auth
// Shows: leads, voice calls, analytics, system status

const ADMIN_TOKEN = "wb-admin-novai-2025-secure";

export function verifyAdmin(request) {
  const url = new URL(request.url);
  // Accept via query param or Authorization header
  const qKey = url.searchParams.get("key");
  const authHeader = request.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace("Bearer ", "");
  return qKey === ADMIN_TOKEN || bearerToken === ADMIN_TOKEN || qKey === "novai2025wb";
}

export function handleAdminDashboard(request) {
  if (!verifyAdmin(request)) {
    return new Response("Unauthorized", { status: 401, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(DASHBOARD_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }
  });
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WorkBench Admin Dashboard</title>
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

  .tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 32px; background: #161b22; }
  .tab { padding: 12px 24px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
  .tab:hover { color: rgba(255,255,255,0.8); }
  .tab.active { color: #0077ff; border-bottom-color: #0077ff; }

  .content { padding: 24px 32px; max-width: 1200px; }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
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
  .loading::after { content: '...'; animation: dots 1.5s infinite; }
  @keyframes dots { 0% { content: '.'; } 33% { content: '..'; } 66% { content: '...'; } }

  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-title .count { font-size: 12px; background: rgba(0,119,255,0.15); color: #58a6ff; padding: 2px 8px; border-radius: 10px; }

  @media (max-width: 768px) {
    .content { padding: 16px; }
    .header { padding: 16px; }
    .tabs { padding: 0 16px; overflow-x: auto; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>

<div class="header">
  <h1><span>WorkBench</span> Admin Dashboard</h1>
  <div class="header-right">
    <div class="header-status">System Online</div>
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
  <div class="loading" id="loading">Loading dashboard</div>
</div>

<script>
var API_KEY = new URLSearchParams(window.location.search).get('key') || 'novai2025wb';
var BASE = window.location.origin;
var data = { leads: [], calls: [], analytics: {} };

function api(path) {
  return fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'key=' + API_KEY)
    .then(function(r) { return r.json(); })
    .catch(function() { return {}; });
}

function loadAll() {
  Promise.all([
    api('/_wb-leads?limit=100'),
    api('/_wb-voice/calls'),
    api('/_wb-voice/analytics')
  ]).then(function(results) {
    data.leads = (results[0] && results[0].leads) || [];
    data.totalLeads = (results[0] && results[0].total) || data.leads.length;
    data.calls = (results[1] && results[1].calls) || [];
    data.totalCalls = (results[1] && results[1].total) || data.calls.length;
    data.analytics = results[2] || {};
    render();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  render(tab);
}

function getActiveTab() {
  var active = document.querySelector('.tab.active');
  return active ? active.getAttribute('data-tab') : 'overview';
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
  var webLeads = data.leads.filter(function(l) { return l.source !== 'vapi_voice'; }).length;
  var voiceLeads = data.leads.filter(function(l) { return l.source === 'vapi_voice'; }).length;
  return '<div class="stats-grid">' +
    stat('Total Leads', data.totalLeads || 0, 'blue') +
    stat('Web Leads', webLeads, 'green') +
    stat('Voice Leads', voiceLeads, 'amber') +
    stat('Voice Calls', data.totalCalls || 0, 'blue') +
    '</div>' +
    '<div class="section-title">Recent Leads <span class="count">' + data.leads.length + '</span></div>' +
    renderLeadTable(data.leads.slice(0, 10)) +
    '<br><div class="section-title">Recent Calls <span class="count">' + data.calls.length + '</span></div>' +
    renderCallTable(data.calls.slice(0, 10));
}

function renderLeads() {
  return '<div class="section-title">All Leads <span class="count">' + data.totalLeads + '</span></div>' +
    renderLeadTable(data.leads);
}

function renderCalls() {
  return '<div class="section-title">Voice Calls <span class="count">' + data.totalCalls + '</span></div>' +
    renderCallTable(data.calls);
}

function renderAnalytics() {
  var a = data.analytics;
  if (!a || !a.daily) return '<div class="empty-state"><p>No analytics data yet. Analytics aggregate after voice calls complete.</p></div>';
  var days = Object.keys(a.daily || {}).sort().reverse();
  var html = '<div class="stats-grid">';
  if (days.length > 0) {
    var today = a.daily[days[0]] || {};
    html += stat('Today Calls', today.total_calls || 0, 'blue');
    html += stat('Leads Captured', today.leads_captured || 0, 'green');
    html += stat('Avg Success', (today.avg_success || 0).toFixed(1) + '/10', 'amber');
    html += stat('Avg Duration', Math.round((today.avg_duration || 0)) + 's', 'blue');
  }
  html += '</div>';
  html += '<div class="section-title">Daily Breakdown</div>';
  html += '<table><thead><tr><th>Date</th><th>Calls</th><th>Leads</th><th>Top Intent</th><th>Avg Success</th><th>Avg Duration</th></tr></thead><tbody>';
  days.forEach(function(day) {
    var d = a.daily[day];
    var topIntent = '-';
    if (d.intents) {
      var maxI = 0; Object.keys(d.intents).forEach(function(k) { if (d.intents[k] > maxI) { maxI = d.intents[k]; topIntent = k; } });
    }
    html += '<tr><td>' + day + '</td><td>' + (d.total_calls || 0) + '</td><td>' + (d.leads_captured || 0) + '</td>';
    html += '<td><span class="badge badge-blue">' + topIntent + '</span></td>';
    html += '<td>' + (d.avg_success || 0).toFixed(1) + '/10</td>';
    html += '<td>' + Math.round(d.avg_duration || 0) + 's</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function stat(label, value, color) {
  return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value ' + color + '">' + value + '</div></div>';
}

function renderLeadTable(leads) {
  if (!leads || leads.length === 0) return '<div class="empty-state"><p>No leads captured yet. Leads appear when visitors fill out the chat form or call the AI agent.</p></div>';
  var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Need</th><th>Source</th><th>Date</th></tr></thead><tbody>';
  leads.forEach(function(l) {
    var source = l.source === 'vapi_voice' ? '<span class="badge badge-amber">Voice</span>' : '<span class="badge badge-blue">Web</span>';
    var date = l.timestamp || l.created || '-';
    if (date !== '-') { try { date = new Date(date).toLocaleString(); } catch(e) {} }
    html += '<tr><td>' + esc(l.name || '-') + '</td><td>' + esc(l.email || '-') + '</td><td>' + esc(l.phone || '-') + '</td>';
    html += '<td>' + esc(l.need || l.product || '-') + '</td><td>' + source + '</td><td>' + date + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderCallTable(calls) {
  if (!calls || calls.length === 0) return '<div class="empty-state"><p>No voice calls logged yet. Calls appear after callers reach the AI voice agent.</p></div>';
  var html = '<table><thead><tr><th>Caller</th><th>Status</th><th>Duration</th><th>Intent</th><th>Outcome</th><th>Score</th><th>Date</th></tr></thead><tbody>';
  calls.forEach(function(c) {
    var status = c.status === 'ended' ? '<span class="badge badge-green">Ended</span>' : '<span class="badge badge-amber">' + (c.status || 'unknown') + '</span>';
    var intent = c.structured_data ? '<span class="badge badge-blue">' + (c.structured_data.caller_intent || '-') + '</span>' : '-';
    var outcome = c.structured_data ? (c.structured_data.outcome || '-') : '-';
    var score = c.success_score || '-';
    var scoreClass = score >= 7 ? 'badge-green' : score >= 4 ? 'badge-amber' : score > 0 ? 'badge-red' : 'badge-blue';
    var date = c.created || '-';
    if (date !== '-') { try { date = new Date(date).toLocaleString(); } catch(e) {} }
    html += '<tr><td>' + esc(c.customer_number || '-') + '</td><td>' + status + '</td>';
    html += '<td>' + (c.duration ? Math.round(c.duration) + 's' : '-') + '</td>';
    html += '<td>' + intent + '</td><td>' + outcome + '</td>';
    html += '<td><span class="badge ' + scoreClass + '">' + score + '</span></td>';
    html += '<td>' + date + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

loadAll();
</script>
</body>
</html>`;
