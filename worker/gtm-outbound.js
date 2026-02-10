// ─── Novai GTM Outbound Worker ────────────────────────────────────
// Handles lead capture, stores in KV, triggers Vapi outbound calls.
//
// Endpoints:
//   POST /lead        — Capture a lead, trigger outbound call if phone provided
//   GET  /leads       — List all stored leads (for admin dashboard)
//   GET  /leads/stats — Aggregate stats for dashboard
//   DELETE /leads     — Clear all leads
//
// Secrets (set via wrangler secret put):
//   VAPI_API_KEY          — Vapi Bearer token
//   ADMIN_API_KEY         — Required for GET /leads, GET /leads/stats, DELETE /leads
//
// Environment vars (set in wrangler.toml [vars]):
//   VAPI_PHONE_NUMBER_ID  — WorkBench GTM Agent phone number ID (outbound from)
//   VAPI_ASSISTANT_ID     — (optional) WorkBench GTM Agent assistant ID
//                           If empty, vapi-server.js handles via assistant-request webhook
//
// KV Namespace:
//   LEADS — bound in wrangler.toml

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Auth: validate Bearer token against ADMIN_API_KEY ──────────
function requireAuth(request, env) {
  if (!env.ADMIN_API_KEY) return null; // No key configured = open (dev mode)
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized — Bearer token required' }, 401);
  }
  const token = auth.slice(7);
  if (token !== env.ADMIN_API_KEY) {
    return json({ error: 'Forbidden — invalid API key' }, 403);
  }
  return null; // Authorized
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ─── POST /lead ───────────────────────────────────────
    if (request.method === 'POST' && path === '/lead') {
      try {
        const lead = await request.json();

        // Validate required fields
        if (!lead.name || !lead.email) {
          return json({ error: 'name and email are required' }, 400);
        }

        // Add server-side metadata
        lead.id = crypto.randomUUID();
        lead.timestamp = lead.timestamp || new Date().toISOString();
        lead.source = lead.source || 'sales-agent';
        lead.outboundCallStatus = 'none';

        // Store in KV
        if (env.LEADS) {
          const existing = JSON.parse(await env.LEADS.get('all_leads') || '[]');
          existing.push(lead);
          await env.LEADS.put('all_leads', JSON.stringify(existing));
          // Also store individually for quick lookup
          await env.LEADS.put(`lead:${lead.id}`, JSON.stringify(lead));
        }

        // Trigger outbound call if phone number provided
        let callResult = null;
        if (lead.phone && env.VAPI_API_KEY && env.VAPI_PHONE_NUMBER_ID) {
          callResult = await triggerOutboundCall(env, lead);

          // Update lead with call status
          if (callResult.success) {
            lead.outboundCallStatus = 'initiated';
            lead.outboundCallId = callResult.callId;
          } else {
            lead.outboundCallStatus = 'failed';
            lead.outboundCallError = callResult.error;
          }

          // Update KV with call status
          if (env.LEADS) {
            await env.LEADS.put(`lead:${lead.id}`, JSON.stringify(lead));
            const existing = JSON.parse(await env.LEADS.get('all_leads') || '[]');
            const idx = existing.findIndex(l => l.id === lead.id);
            if (idx !== -1) {
              existing[idx] = lead;
              await env.LEADS.put('all_leads', JSON.stringify(existing));
            }
          }
        }

        return json({
          success: true,
          leadId: lead.id,
          outboundCall: callResult,
        }, 201);

      } catch (e) {
        return json({ error: 'Invalid request body', detail: e.message }, 400);
      }
    }

    // ─── GET /leads ───────────────────────────────────────
    if (request.method === 'GET' && path === '/leads') {
      const authErr = requireAuth(request, env);
      if (authErr) return authErr;
      if (!env.LEADS) {
        return json([]);
      }
      const leads = JSON.parse(await env.LEADS.get('all_leads') || '[]');
      return json(leads);
    }

    // ─── GET /leads/stats ─────────────────────────────────
    if (request.method === 'GET' && path === '/leads/stats') {
      const authErr = requireAuth(request, env);
      if (authErr) return authErr;
      if (!env.LEADS) {
        return json({ total: 0, today: 0, withPhone: 0, products: {}, daily: {} });
      }
      const leads = JSON.parse(await env.LEADS.get('all_leads') || '[]');
      const today = new Date().toISOString().split('T')[0];

      const stats = {
        total: leads.length,
        today: leads.filter(l => l.timestamp && l.timestamp.startsWith(today)).length,
        withPhone: leads.filter(l => l.phone).length,
        outboundCalls: leads.filter(l => l.outboundCallStatus === 'initiated').length,
        products: {},
        daily: {},
        sources: {},
      };

      leads.forEach(l => {
        const p = l.product || 'Unknown';
        stats.products[p] = (stats.products[p] || 0) + 1;

        const d = l.timestamp ? l.timestamp.split('T')[0] : 'Unknown';
        stats.daily[d] = (stats.daily[d] || 0) + 1;

        const s = l.source || 'unknown';
        stats.sources[s] = (stats.sources[s] || 0) + 1;
      });

      return json(stats);
    }

    // ─── GET /leads/full ──────────────────────────────────
    // Returns leads + call reports + callbacks for the full picture
    if (request.method === 'GET' && path === '/leads/full') {
      const authErr = requireAuth(request, env);
      if (authErr) return authErr;
      if (!env.LEADS) {
        return json({ leads: [], callReports: [], callbacks: [] });
      }
      const [leads, callReports, callbacks] = await Promise.all([
        env.LEADS.get('all_leads').then(v => JSON.parse(v || '[]')),
        env.LEADS.get('call_reports').then(v => JSON.parse(v || '[]')),
        env.LEADS.get('callbacks').then(v => JSON.parse(v || '[]')),
      ]);
      return json({ leads, callReports, callbacks });
    }

    // ─── GET /diagnostics ──────────────────────────────────
    if (request.method === 'GET' && path === '/diagnostics') {
      const authErr = requireAuth(request, env);
      if (authErr) return authErr;
      if (!env.LEADS) {
        return json({ status: 'error', message: 'KV namespace not bound', kvBound: false });
      }
      const [leadsRaw, reportsRaw, callbacksRaw, keysList] = await Promise.all([
        env.LEADS.get('all_leads'),
        env.LEADS.get('call_reports'),
        env.LEADS.get('callbacks'),
        env.LEADS.list({ limit: 100 }),
      ]);
      const leads = JSON.parse(leadsRaw || '[]');
      const reports = JSON.parse(reportsRaw || '[]');
      const callbacks = JSON.parse(callbacksRaw || '[]');

      // Find latest timestamps
      const latestLead = leads.length > 0 ? leads.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).timestamp : null;
      const latestReport = reports.length > 0 ? reports.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).timestamp : null;

      return json({
        status: 'ok',
        kvBound: true,
        counts: {
          leads: leads.length,
          callReports: reports.length,
          callbacks: callbacks.length,
          kvKeys: keysList.keys.length,
        },
        latestTimestamps: {
          lead: latestLead,
          callReport: latestReport,
        },
        kvKeys: keysList.keys.map(k => k.name),
        serverTime: new Date().toISOString(),
      });
    }

    // ─── DELETE /leads ────────────────────────────────────
    if (request.method === 'DELETE' && path === '/leads') {
      const authErr = requireAuth(request, env);
      if (authErr) return authErr;
      if (env.LEADS) {
        await env.LEADS.put('all_leads', '[]');
      }
      return json({ success: true, message: 'All leads cleared' });
    }

    // ─── 404 ──────────────────────────────────────────────
    return json({ error: 'Not found' }, 404);
  },
};

// ─── Vapi Outbound Call ──────────────────────────────────────────
async function triggerOutboundCall(env, lead) {
  try {
    // Normalize phone number — ensure it has country code
    let phone = lead.phone.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
      phone = '+1' + phone; // Default to US
    }

    const body = {
      phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
      customer: {
        number: phone,
        name: lead.name,
      },
    };

    // Use explicit assistant ID if configured, otherwise server URL handles it
    if (env.VAPI_ASSISTANT_ID) {
      body.assistantId = env.VAPI_ASSISTANT_ID;
      body.assistantOverrides = {
        variableValues: {
          customerName: lead.name,
          customerEmail: lead.email,
          productInterest: lead.product || 'General',
          customerNeed: lead.need || '',
          leadSource: lead.source || 'website',
        },
      };
    } else {
      // No assistant ID — server URL's assistant-request webhook provides the config
      // Pass lead context so vapi-server.js can personalize the agent
      body.assistantOverrides = {
        variableValues: {
          customerName: lead.name,
          customerEmail: lead.email,
          productInterest: lead.product || 'General',
          customerNeed: lead.need || '',
          leadSource: lead.source || 'website',
        },
      };
    }

    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.VAPI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      return { success: true, callId: data.id, status: data.status };
    } else {
      return { success: false, error: data.message || 'Vapi API error', status: res.status };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
