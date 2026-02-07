// ─── Vapi Voice Agent — Webhook Handler + Analytics ──────────────────
// Handles Vapi webhook events for call tracking, lead capture, and analytics
// Endpoints:
//   POST /_wb-voice/webhook   — Vapi server URL (receives all call events)
//   GET  /_wb-voice/calls     — Admin call log viewer
//   GET  /_wb-voice/analytics — Aggregated analytics dashboard
//   GET  /_wb-voice/health    — Diagnostic health check
//   POST /_wb-voice/test      — Seed test data for dashboard verification

import { verifyAdmin } from './admin-dashboard.js';

const WEBHOOK_SECRET = "wb-vapi-2025";

// ─── KV helper with error handling ────────────────────────────────────
async function kvPut(env, key, value) {
  try {
    if (!env.WB_LEADS) {
      console.error("[KV] WB_LEADS binding not available");
      return false;
    }
    await env.WB_LEADS.put(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("[KV] PUT failed:", key, e.message);
    return false;
  }
}

async function kvGet(env, key) {
  try {
    if (!env.WB_LEADS) return null;
    return await env.WB_LEADS.get(key);
  } catch (e) {
    console.error("[KV] GET failed:", key, e.message);
    return null;
  }
}

// ─── Event log — stores last 50 webhook events for debugging ─────────
async function logEvent(env, eventType, callId, details) {
  try {
    if (!env.WB_LEADS) return;
    const logRaw = await env.WB_LEADS.get("_event_log");
    const log = logRaw ? JSON.parse(logRaw) : [];
    log.unshift({
      type: eventType,
      call_id: callId || "",
      details: details || "",
      time: new Date().toISOString()
    });
    // Keep last 50 events
    if (log.length > 50) log.length = 50;
    await env.WB_LEADS.put("_event_log", JSON.stringify(log));
  } catch (e) {
    console.error("[EventLog] Failed:", e.message);
  }
}

// ─── Main webhook handler ────────────────────────────────────────────
export async function handleVoiceWebhook(request, env) {
  if (request.method === "OPTIONS") {
    return corsResponse(null, 204);
  }

  try {
    const payload = await request.json();
    const event = payload.message || payload;
    const eventType = event.type || "unknown";
    const callId = event.call?.id || "";

    console.log("[Voice Agent] Event:", eventType, "call:", callId, "KV:", !!env.WB_LEADS);

    // Log every event for debugging
    await logEvent(env, eventType, callId, event.status || "");

    switch (eventType) {
      case "assistant-request":
        return handleAssistantRequest(event, env);
      case "function-call":
        return await handleFunctionCall(event, env);
      case "status-update":
        return await handleStatusUpdate(event, env);
      case "end-of-call-report":
        return await handleEndOfCall(event, env);
      case "hang":
        return handleHang(event, env);
      case "speech-update":
        return corsResponse({ ok: true });
      case "transcript":
        return corsResponse({ ok: true });
      default:
        console.log("[Voice Agent] Unknown event type:", eventType);
        return corsResponse({ ok: true, event: eventType });
    }
  } catch (e) {
    console.error("[Voice Agent] Webhook error:", e.message, e.stack);
    return corsResponse({ error: e.message }, 500);
  }
}

// ─── Assistant request — tell Vapi which assistant to use ────────────
function handleAssistantRequest(event, env) {
  console.log("[Voice Agent] Assistant request — returning assistant ID");
  return corsResponse({
    assistantId: "66890f6b-a091-4922-83ed-46328ecfecd1"
  });
}

// ─── Function calls — custom tool handling ───────────────────────────
async function handleFunctionCall(event, env) {
  const fn = event.functionCall;
  if (!fn) return corsResponse({ ok: true });

  switch (fn.name) {
    case "capture_lead":
      return await handleCaptureLead(fn.parameters, event.call, env);
    case "transfer_human":
      return corsResponse({
        result: "Transferring to human agent. The team can be reached at +1 (213) 943-3042. Or call our AI line anytime at +1 (943) 223-9707."
      });
    case "check_services":
      return corsResponse({
        result: "You can browse all services at workbench.novaisystems.online/services. We have home services, business services, and lifestyle services across LA."
      });
    default:
      return corsResponse({ result: "Action completed." });
  }
}

// ─── Lead capture from voice call ────────────────────────────────────
async function handleCaptureLead(params, call, env) {
  const lead = {
    name: params.name || "",
    email: params.email || "",
    phone: params.phone || call?.customer?.number || "",
    need: params.service_need || "",
    product: "WorkBench — Voice Agent",
    timestamp: new Date().toISOString(),
    source: "vapi_voice",
    call_id: call?.id || "",
    caller_number: call?.customer?.number || ""
  };

  const id = "lead_voice_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  lead.id = id;

  const stored = await kvPut(env, id, lead);
  if (stored) {
    const indexRaw = await kvGet(env, "_index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift(id);
    await kvPut(env, "_index", index);
    console.log("[Voice Agent] Lead captured:", id);
  } else {
    console.error("[Voice Agent] Lead capture FAILED — KV unavailable");
  }

  return corsResponse({ result: "Lead captured successfully. I've saved their information." });
}

// ─── Status updates — track call progress ────────────────────────────
async function handleStatusUpdate(event, env) {
  const call = event.call || {};
  const status = event.status || call.status;
  const callId = call.id;

  console.log("[Voice Agent] Status:", status, "call:", callId);

  if (!callId) {
    console.log("[Voice Agent] Status update has no call ID, skipping storage");
    return corsResponse({ ok: true });
  }

  const callKey = "call_" + callId;
  const existing = await kvGet(env, callKey);
  const callData = existing ? JSON.parse(existing) : {
    id: callId,
    created: new Date().toISOString(),
    events: []
  };

  callData.status = status;
  callData.customer_number = call.customer?.number || callData.customer_number || "";
  callData.events.push({
    type: "status",
    status: status,
    timestamp: new Date().toISOString()
  });

  if (status === "ended") {
    callData.ended = new Date().toISOString();
    callData.duration = call.duration || 0;
    callData.cost = call.cost || 0;

    // Update call index
    const callIndexRaw = await kvGet(env, "_call_index");
    const callIndex = callIndexRaw ? JSON.parse(callIndexRaw) : [];
    if (!callIndex.includes(callKey)) {
      callIndex.unshift(callKey);
      await kvPut(env, "_call_index", callIndex);
    }
    console.log("[Voice Agent] Call ended:", callId, "duration:", callData.duration);
  }

  await kvPut(env, callKey, callData);
  return corsResponse({ ok: true });
}

// ─── End of call report — full analytics ─────────────────────────────
async function handleEndOfCall(event, env) {
  const call = event.call || {};
  const analysis = event.analysis || {};
  const transcript = event.transcript || "";
  const summary = event.summary || analysis.summary || "";
  const recordingUrl = event.recordingUrl || "";
  const structuredData = analysis.structuredData || {};
  const successEval = analysis.successEvaluation || null;

  console.log("[Voice Agent] End of call:", call.id, "analysis keys:", Object.keys(analysis).join(","));

  const report = {
    id: call.id,
    type: "end_of_call_report",
    created: new Date().toISOString(),
    customer_number: call.customer?.number || "",
    duration: call.duration || 0,
    cost: call.cost || 0,
    ended_reason: call.endedReason || "",
    transcript: transcript,
    summary: summary,
    recording_url: recordingUrl,
    structured_data: structuredData,
    success_score: successEval,
    caller_intent: structuredData.caller_intent || "unknown",
    service_category: structuredData.service_category || "unknown",
    specific_service: structuredData.specific_service || "",
    location: structuredData.location || "",
    outcome: structuredData.outcome || "unknown",
    sentiment: structuredData.sentiment || "neutral",
    objections: structuredData.objections || [],
    lead_name: structuredData.lead_name || "",
    lead_email: structuredData.lead_email || "",
    lead_phone: structuredData.lead_phone || call.customer?.number || ""
  };

  // Store report
  const reportKey = "report_" + call.id;
  const stored = await kvPut(env, reportKey, report);
  if (!stored) {
    console.error("[Voice Agent] FAILED to store report for call:", call.id);
    return corsResponse({ ok: false, error: "KV write failed" });
  }

  // Update report index
  const reportIndexRaw = await kvGet(env, "_report_index");
  const reportIndex = reportIndexRaw ? JSON.parse(reportIndexRaw) : [];
  reportIndex.unshift(reportKey);
  await kvPut(env, "_report_index", reportIndex);

  // If we got lead info from analysis, capture it as a lead too
  if (report.lead_email || report.lead_phone) {
    const leadId = "lead_voice_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const lead = {
      id: leadId,
      name: report.lead_name,
      email: report.lead_email,
      phone: report.lead_phone,
      need: report.specific_service,
      product: "WorkBench — Voice Agent",
      timestamp: report.created,
      source: "vapi_voice_analysis",
      call_id: call.id,
      intent: report.caller_intent,
      sentiment: report.sentiment,
      outcome: report.outcome
    };
    await kvPut(env, leadId, lead);

    const indexRaw = await kvGet(env, "_index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift(leadId);
    await kvPut(env, "_index", index);
    console.log("[Voice Agent] Voice lead captured:", leadId);
  }

  // Update daily analytics
  const today = new Date().toISOString().slice(0, 10);
  const dailyKey = "analytics_" + today;
  const dailyRaw = await kvGet(env, dailyKey);
  const daily = dailyRaw ? JSON.parse(dailyRaw) : {
    date: today,
    total_calls: 0,
    total_duration: 0,
    total_cost: 0,
    intents: {},
    outcomes: {},
    sentiments: {},
    categories: {},
    success_scores: [],
    leads_captured: 0
  };

  daily.total_calls++;
  daily.total_duration += report.duration;
  daily.total_cost += report.cost;
  daily.intents[report.caller_intent] = (daily.intents[report.caller_intent] || 0) + 1;
  daily.outcomes[report.outcome] = (daily.outcomes[report.outcome] || 0) + 1;
  daily.sentiments[report.sentiment] = (daily.sentiments[report.sentiment] || 0) + 1;
  daily.categories[report.service_category] = (daily.categories[report.service_category] || 0) + 1;
  if (successEval) daily.success_scores.push(successEval);
  if (report.lead_email || report.lead_phone) daily.leads_captured++;

  await kvPut(env, dailyKey, daily);

  console.log("[Voice Agent] End of call report stored:", call.id, "outcome:", report.outcome);
  return corsResponse({ ok: true });
}

// ─── Hang event ──────────────────────────────────────────────────────
function handleHang(event, env) {
  return corsResponse({ ok: true });
}

// ─── Health check: GET /_wb-voice/health?key=ADMIN_KEY ───────────────
export async function handleHealth(request, env) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "unauthorized" }, 401);
  }

  const checks = {
    kv_bound: !!env.WB_LEADS,
    kv_readable: false,
    kv_writable: false,
    event_log: [],
    indexes: {},
    timestamp: new Date().toISOString()
  };

  if (env.WB_LEADS) {
    // Test read
    try {
      await env.WB_LEADS.get("_health_check");
      checks.kv_readable = true;
    } catch (e) {
      checks.kv_read_error = e.message;
    }

    // Test write
    try {
      await env.WB_LEADS.put("_health_check", new Date().toISOString());
      checks.kv_writable = true;
    } catch (e) {
      checks.kv_write_error = e.message;
    }

    // Get event log
    try {
      const logRaw = await env.WB_LEADS.get("_event_log");
      checks.event_log = logRaw ? JSON.parse(logRaw) : [];
    } catch (e) {
      checks.event_log_error = e.message;
    }

    // Check indexes
    try {
      const leadIdx = await env.WB_LEADS.get("_index");
      checks.indexes.leads = leadIdx ? JSON.parse(leadIdx).length : 0;
    } catch (e) {}
    try {
      const callIdx = await env.WB_LEADS.get("_call_index");
      checks.indexes.calls = callIdx ? JSON.parse(callIdx).length : 0;
    } catch (e) {}
    try {
      const reportIdx = await env.WB_LEADS.get("_report_index");
      checks.indexes.reports = reportIdx ? JSON.parse(reportIdx).length : 0;
    } catch (e) {}
  }

  return corsResponse(checks);
}

// ─── Test data seeder: POST /_wb-voice/test?key=ADMIN_KEY ────────────
export async function handleTestSeed(request, env) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "unauthorized" }, 401);
  }

  if (!env.WB_LEADS) {
    return corsResponse({ error: "KV not bound", kv_available: false }, 500);
  }

  const results = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 1. Create a test lead
  const leadId = "lead_test_" + Date.now();
  const lead = {
    id: leadId,
    name: "Test Lead",
    email: "test@example.com",
    phone: "+12135551234",
    need: "Home cleaning",
    product: "WorkBench — Test",
    timestamp: now.toISOString(),
    source: "test_seed",
    call_id: "test-call-001"
  };
  const leadOk = await kvPut(env, leadId, lead);
  results.push({ action: "store_lead", key: leadId, ok: leadOk });

  // Update lead index
  const idxRaw = await kvGet(env, "_index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  idx.unshift(leadId);
  await kvPut(env, "_index", idx);

  // 2. Create a test call
  const callKey = "call_test-call-001";
  const callData = {
    id: "test-call-001",
    created: now.toISOString(),
    status: "ended",
    ended: now.toISOString(),
    customer_number: "+12135551234",
    duration: 45,
    cost: 0.03,
    events: [
      { type: "status", status: "ringing", timestamp: new Date(now - 50000).toISOString() },
      { type: "status", status: "in-progress", timestamp: new Date(now - 45000).toISOString() },
      { type: "status", status: "ended", timestamp: now.toISOString() }
    ]
  };
  const callOk = await kvPut(env, callKey, callData);
  results.push({ action: "store_call", key: callKey, ok: callOk });

  const callIdxRaw = await kvGet(env, "_call_index");
  const callIdx = callIdxRaw ? JSON.parse(callIdxRaw) : [];
  callIdx.unshift(callKey);
  await kvPut(env, "_call_index", callIdx);

  // 3. Create a test report
  const reportKey = "report_test-call-001";
  const report = {
    id: "test-call-001",
    type: "end_of_call_report",
    created: now.toISOString(),
    customer_number: "+12135551234",
    duration: 45,
    cost: 0.03,
    ended_reason: "customer-ended-call",
    summary: "Test call — customer asked about home cleaning services in West LA. Showed high interest.",
    success_score: 8,
    caller_intent: "service_inquiry",
    service_category: "home_services",
    specific_service: "home cleaning",
    location: "West LA",
    outcome: "lead_captured",
    sentiment: "positive",
    lead_name: "Test Lead",
    lead_email: "test@example.com",
    lead_phone: "+12135551234"
  };
  const reportOk = await kvPut(env, reportKey, report);
  results.push({ action: "store_report", key: reportKey, ok: reportOk });

  const rptIdxRaw = await kvGet(env, "_report_index");
  const rptIdx = rptIdxRaw ? JSON.parse(rptIdxRaw) : [];
  rptIdx.unshift(reportKey);
  await kvPut(env, "_report_index", rptIdx);

  // 4. Create daily analytics
  const dailyKey = "analytics_" + today;
  const daily = {
    date: today,
    total_calls: 1,
    total_duration: 45,
    total_cost: 0.03,
    intents: { service_inquiry: 1 },
    outcomes: { lead_captured: 1 },
    sentiments: { positive: 1 },
    categories: { home_services: 1 },
    success_scores: [8],
    leads_captured: 1
  };
  const dailyOk = await kvPut(env, dailyKey, daily);
  results.push({ action: "store_analytics", key: dailyKey, ok: dailyOk });

  return corsResponse({
    ok: results.every(r => r.ok),
    message: "Test data seeded. Refresh the GTM Dashboard to see it.",
    results
  });
}

// ─── Clear all data: DELETE /_wb-voice/test?key=ADMIN_KEY ─────────────
export async function handleClearData(request, env) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "unauthorized" }, 401);
  }
  if (!env.WB_LEADS) {
    return corsResponse({ error: "KV not bound" }, 500);
  }

  // Clear all indexes and their referenced data
  const indexes = ["_index", "_call_index", "_report_index", "_event_log"];
  for (const idx of indexes) {
    try {
      const raw = await env.WB_LEADS.get(idx);
      if (raw) {
        const keys = JSON.parse(raw);
        if (Array.isArray(keys)) {
          for (const key of keys) {
            await env.WB_LEADS.delete(key);
          }
        }
      }
      await env.WB_LEADS.delete(idx);
    } catch (e) {
      console.error("[Clear] Error clearing", idx, e.message);
    }
  }

  // Clear analytics for last 30 days
  const now = new Date();
  for (let d = 0; d < 30; d++) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    try { await env.WB_LEADS.delete("analytics_" + date); } catch(e) {}
  }

  return corsResponse({ ok: true, message: "All data cleared." });
}

// ─── Call log viewer: GET /_wb-voice/calls?key=ADMIN_KEY ─────────────
export async function handleCallLog(request, env) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "unauthorized" }, 401);
  }
  const url = new URL(request.url);

  if (!env.WB_LEADS) {
    return corsResponse({ calls: [], total: 0, note: "KV not configured" });
  }

  try {
    const callIndexRaw = await kvGet(env, "_call_index");
    const callIndex = callIndexRaw ? JSON.parse(callIndexRaw) : [];
    const limit = parseInt(url.searchParams.get("limit") || "30");
    const calls = [];

    for (let i = 0; i < Math.min(callIndex.length, limit); i++) {
      const raw = await kvGet(env, callIndex[i]);
      if (raw) calls.push(JSON.parse(raw));
    }

    return corsResponse({ total: callIndex.length, calls });
  } catch (e) {
    console.error("[Voice Agent] Call log error:", e.message);
    return corsResponse({ error: e.message, calls: [], total: 0 }, 500);
  }
}

// ─── Analytics: GET /_wb-voice/analytics?key=ADMIN_KEY ────────────────
export async function handleAnalytics(request, env) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "unauthorized" }, 401);
  }
  const url = new URL(request.url);

  if (!env.WB_LEADS) {
    return corsResponse({ totals: {}, daily: [], recent_reports: [], note: "KV not configured" });
  }

  try {
    const days = parseInt(url.searchParams.get("days") || "30");
    const analytics = [];
    const now = new Date();

    for (let d = 0; d < days; d++) {
      const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
      const raw = await kvGet(env, "analytics_" + date);
      if (raw) analytics.push(JSON.parse(raw));
    }

    const reportIndexRaw = await kvGet(env, "_report_index");
    const reportIndex = reportIndexRaw ? JSON.parse(reportIndexRaw) : [];
    const recentReports = [];
    for (let i = 0; i < Math.min(reportIndex.length, 10); i++) {
      const raw = await kvGet(env, reportIndex[i]);
      if (raw) {
        const report = JSON.parse(raw);
        delete report.transcript;
        recentReports.push(report);
      }
    }

    const totals = {
      total_calls: 0, total_duration: 0, total_cost: 0, total_leads: 0,
      avg_success_score: 0, intents: {}, outcomes: {}, sentiments: {}, categories: {}
    };

    let allScores = [];
    for (const day of analytics) {
      totals.total_calls += day.total_calls;
      totals.total_duration += day.total_duration;
      totals.total_cost += day.total_cost;
      totals.total_leads += day.leads_captured;
      allScores = allScores.concat(day.success_scores || []);
      for (const [k, v] of Object.entries(day.intents || {})) totals.intents[k] = (totals.intents[k] || 0) + v;
      for (const [k, v] of Object.entries(day.outcomes || {})) totals.outcomes[k] = (totals.outcomes[k] || 0) + v;
      for (const [k, v] of Object.entries(day.sentiments || {})) totals.sentiments[k] = (totals.sentiments[k] || 0) + v;
      for (const [k, v] of Object.entries(day.categories || {})) totals.categories[k] = (totals.categories[k] || 0) + v;
    }
    if (allScores.length > 0) {
      totals.avg_success_score = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    }

    return corsResponse({
      period: days + " days",
      totals,
      daily: analytics,
      recent_reports: recentReports
    });
  } catch (e) {
    console.error("[Voice Agent] Analytics error:", e.message);
    return corsResponse({ error: e.message, totals: {}, daily: [], recent_reports: [] }, 500);
  }
}

// ─── CORS helper ─────────────────────────────────────────────────────
function corsResponse(data, status = 200) {
  return new Response(data ? JSON.stringify(data) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
