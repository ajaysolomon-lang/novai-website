// ─── Vapi Voice Agent — Webhook Handler + Analytics ──────────────────
// Handles Vapi webhook events for call tracking, lead capture, and analytics
// Endpoints:
//   POST /_wb-voice/webhook   — Vapi server URL (receives all call events)
//   GET  /_wb-voice/calls     — Admin call log viewer
//   GET  /_wb-voice/analytics — Aggregated analytics dashboard

const WEBHOOK_SECRET = "wb-vapi-2025";

// ─── Main webhook handler ────────────────────────────────────────────
export async function handleVoiceWebhook(request, env) {
  if (request.method === "OPTIONS") {
    return corsResponse(null, 204);
  }

  try {
    const payload = await request.json();
    const event = payload.message || payload;

    // Log every event
    console.log("[Voice Agent] Event:", event.type, event.call?.id || "");

    switch (event.type) {
      case "assistant-request":
        return handleAssistantRequest(event, env);
      case "function-call":
        return handleFunctionCall(event, env);
      case "status-update":
        return handleStatusUpdate(event, env);
      case "end-of-call-report":
        return handleEndOfCall(event, env);
      case "hang":
        return handleHang(event, env);
      case "speech-update":
        return corsResponse({ ok: true });
      case "transcript":
        return corsResponse({ ok: true });
      default:
        return corsResponse({ ok: true, event: event.type });
    }
  } catch (e) {
    console.error("[Voice Agent] Webhook error:", e.message);
    return corsResponse({ error: e.message }, 500);
  }
}

// ─── Assistant request — dynamic config override ─────────────────────
function handleAssistantRequest(event, env) {
  // Can override assistant config per-call based on caller info
  // For now, return nothing to use the default assistant config
  return corsResponse({ ok: true });
}

// ─── Function calls — custom tool handling ───────────────────────────
async function handleFunctionCall(event, env) {
  const fn = event.functionCall;
  if (!fn) return corsResponse({ ok: true });

  switch (fn.name) {
    case "capture_lead":
      return handleCaptureLead(fn.parameters, event.call, env);
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

  // Store in KV if available
  if (env.WB_LEADS) {
    const id = "lead_voice_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    lead.id = id;
    await env.WB_LEADS.put(id, JSON.stringify(lead));

    const indexRaw = await env.WB_LEADS.get("_index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift(id);
    await env.WB_LEADS.put("_index", JSON.stringify(index));
  }

  console.log("[Voice Agent] Lead captured:", JSON.stringify(lead));
  return corsResponse({ result: "Lead captured successfully. I've saved their information." });
}

// ─── Status updates — track call progress ────────────────────────────
async function handleStatusUpdate(event, env) {
  const call = event.call || {};
  const status = event.status || call.status;

  if (env.WB_LEADS && call.id) {
    const callKey = "call_" + call.id;
    const existing = await env.WB_LEADS.get(callKey);
    const callData = existing ? JSON.parse(existing) : {
      id: call.id,
      created: new Date().toISOString(),
      events: []
    };

    callData.status = status;
    callData.customer_number = call.customer?.number || callData.customer_number;
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
      const callIndexRaw = await env.WB_LEADS.get("_call_index");
      const callIndex = callIndexRaw ? JSON.parse(callIndexRaw) : [];
      if (!callIndex.includes(callKey)) {
        callIndex.unshift(callKey);
        await env.WB_LEADS.put("_call_index", JSON.stringify(callIndex));
      }
    }

    await env.WB_LEADS.put(callKey, JSON.stringify(callData));
  }

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
    // Extracted analytics
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

  if (env.WB_LEADS) {
    // Store the full report
    const reportKey = "report_" + call.id;
    await env.WB_LEADS.put(reportKey, JSON.stringify(report));

    // Update report index
    const reportIndexRaw = await env.WB_LEADS.get("_report_index");
    const reportIndex = reportIndexRaw ? JSON.parse(reportIndexRaw) : [];
    reportIndex.unshift(reportKey);
    await env.WB_LEADS.put("_report_index", JSON.stringify(reportIndex));

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
      await env.WB_LEADS.put(leadId, JSON.stringify(lead));

      const indexRaw = await env.WB_LEADS.get("_index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      index.unshift(leadId);
      await env.WB_LEADS.put("_index", JSON.stringify(index));
    }

    // Update daily analytics counter
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = "analytics_" + today;
    const dailyRaw = await env.WB_LEADS.get(dailyKey);
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

    await env.WB_LEADS.put(dailyKey, JSON.stringify(daily));
  }

  console.log("[Voice Agent] End of call report:", call.id, "outcome:", report.outcome, "score:", report.success_score);
  return corsResponse({ ok: true });
}

// ─── Hang event ──────────────────────────────────────────────────────
function handleHang(event, env) {
  return corsResponse({ ok: true });
}

// ─── Call log viewer: GET /_wb-voice/calls?key=ADMIN_KEY ─────────────
export async function handleCallLog(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== "novai2025wb") {
    return corsResponse({ error: "unauthorized" }, 401);
  }

  if (!env.WB_LEADS) {
    return corsResponse({ calls: [], note: "KV not configured" });
  }

  const callIndexRaw = await env.WB_LEADS.get("_call_index");
  const callIndex = callIndexRaw ? JSON.parse(callIndexRaw) : [];
  const limit = parseInt(url.searchParams.get("limit") || "30");
  const calls = [];

  for (let i = 0; i < Math.min(callIndex.length, limit); i++) {
    const raw = await env.WB_LEADS.get(callIndex[i]);
    if (raw) calls.push(JSON.parse(raw));
  }

  return new Response(JSON.stringify({ total: callIndex.length, calls }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

// ─── Analytics dashboard: GET /_wb-voice/analytics?key=ADMIN_KEY ─────
export async function handleAnalytics(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== "novai2025wb") {
    return corsResponse({ error: "unauthorized" }, 401);
  }

  if (!env.WB_LEADS) {
    return corsResponse({ analytics: null, note: "KV not configured" });
  }

  // Get last 30 days of analytics
  const days = parseInt(url.searchParams.get("days") || "30");
  const analytics = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    const raw = await env.WB_LEADS.get("analytics_" + date);
    if (raw) analytics.push(JSON.parse(raw));
  }

  // Get recent reports for detailed view
  const reportIndexRaw = await env.WB_LEADS.get("_report_index");
  const reportIndex = reportIndexRaw ? JSON.parse(reportIndexRaw) : [];
  const recentReports = [];
  for (let i = 0; i < Math.min(reportIndex.length, 10); i++) {
    const raw = await env.WB_LEADS.get(reportIndex[i]);
    if (raw) {
      const report = JSON.parse(raw);
      // Don't include full transcript in summary view
      delete report.transcript;
      recentReports.push(report);
    }
  }

  // Aggregate totals
  const totals = {
    total_calls: 0,
    total_duration: 0,
    total_cost: 0,
    total_leads: 0,
    avg_success_score: 0,
    intents: {},
    outcomes: {},
    sentiments: {},
    categories: {}
  };

  let allScores = [];
  for (const day of analytics) {
    totals.total_calls += day.total_calls;
    totals.total_duration += day.total_duration;
    totals.total_cost += day.total_cost;
    totals.total_leads += day.leads_captured;
    allScores = allScores.concat(day.success_scores || []);
    for (const [k, v] of Object.entries(day.intents)) totals.intents[k] = (totals.intents[k] || 0) + v;
    for (const [k, v] of Object.entries(day.outcomes)) totals.outcomes[k] = (totals.outcomes[k] || 0) + v;
    for (const [k, v] of Object.entries(day.sentiments)) totals.sentiments[k] = (totals.sentiments[k] || 0) + v;
    for (const [k, v] of Object.entries(day.categories)) totals.categories[k] = (totals.categories[k] || 0) + v;
  }
  if (allScores.length > 0) {
    totals.avg_success_score = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
  }

  return new Response(JSON.stringify({
    period: days + " days",
    totals,
    daily: analytics,
    recent_reports: recentReports
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
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
