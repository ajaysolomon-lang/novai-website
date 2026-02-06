// ─── Novai Vapi Server — AI Receptionist + GTM Agent Backend ──────
//
// Handles ALL Vapi webhooks for both phone numbers:
//   +1 (213) 943-3042 — Inbound receptionist (WorkBench-focused)
//   +1 (943) 223 9707 — Outbound GTM agent
//
// Webhook events handled:
//   assistant-request  — Dynamic assistant config with full WorkBench knowledge
//   tool-calls         — Scheduling, routing, lead capture, service lookup
//   end-of-call-report — Log call outcomes
//   status-update      — Track call status changes
//
// Deploy: npx wrangler deploy --config vapi-wrangler.toml

// ─── WorkBench Knowledge Base ────────────────────────────────────
const WORKBENCH_KNOWLEDGE = {
  about: `WorkBench is a local services marketplace built by Novai Systems, currently serving Los Angeles. It connects customers with vetted, trusted service providers for home, business, and lifestyle needs. Free for customers — zero platform fees. Providers keep more of what they earn.`,

  services: {
    home: [
      'House cleaning (regular, deep clean, move-in/move-out)',
      'Plumbing (repairs, installations, emergency)',
      'Electrical (wiring, panel upgrades, smart home)',
      'HVAC (AC repair, heating, duct cleaning)',
      'Landscaping (lawn care, design, tree trimming)',
      'Handyman (general repairs, assembly, mounting)',
      'Painting (interior, exterior, touch-ups)',
      'Pest control',
      'Roofing and gutters',
      'Locksmith services',
    ],
    business: [
      'Commercial cleaning and janitorial',
      'IT support and managed services',
      'Accounting and bookkeeping',
      'Marketing and social media management',
      'Legal services (business law, contracts)',
      'Commercial HVAC and maintenance',
      'Office renovation and buildout',
      'Security systems and monitoring',
    ],
    lifestyle: [
      'Personal training and fitness coaching',
      'Beauty services (hair, nails, skincare)',
      'Wellness (massage, acupuncture, chiropractic)',
      'Event planning and coordination',
      'Photography and videography',
      'Catering and personal chef',
      'Pet grooming and care',
      'Tutoring and lessons (music, language, academic)',
    ],
  },

  howItWorks: {
    customers: [
      '1. Visit workbench.novaisystems.online',
      '2. Browse service categories or search for what you need',
      '3. View vetted provider profiles, ratings, and reviews',
      '4. Book directly — no bidding wars, transparent pricing',
      '5. Rate and review after service completion',
    ],
    providers: [
      '1. Apply to join WorkBench as a service provider',
      '2. Complete vetting process (credentials, background, portfolio)',
      '3. Create your professional profile with services and rates',
      '4. Receive booking requests from local customers',
      '5. Manage your schedule and grow your business',
    ],
  },

  pricing: {
    customers: 'Completely free. No sign-up fees, no booking fees, no hidden charges.',
    providers: 'Fair commission structure — significantly lower than competitors like Thumbtack or Angi. Providers keep more of what they earn. Specific rates vary by service category.',
  },

  coverage: 'Currently serving the greater Los Angeles metro area including LA proper, Santa Monica, Beverly Hills, Pasadena, Long Beach, Glendale, Burbank, and surrounding communities. Expanding to additional California markets soon.',

  differentiators: [
    'Free for customers — no platform fees',
    'All providers are vetted and verified',
    'Direct booking — no bidding wars',
    'Transparent pricing — no surprises',
    'Lower fees for providers than competitors',
    'Built by Novai Systems with AI-powered matching',
    'Local focus — built for LA, by LA',
  ],

  contact: {
    phone: '+1 (213) 943-3042',
    website: 'workbench.novaisystems.online',
    company: 'Novai Systems LLC',
    location: 'Los Angeles, CA',
  },

  enterprise: {
    about: 'Novai Systems LLC is an AI technology company headquartered in Los Angeles. We build self-correcting AI tools powered by AIREC technology — predictive intelligence that learns, adapts, and delivers measurable results without manual babysitting.',
    mission: 'We build AI that actually works — not the "sprinkle AI on it" kind. Every product uses self-correcting loops with predictive intelligence baked in.',
    founded: 'Los Angeles, CA',
    website: 'novaisystems.online',
    tagline: 'AI That Actually Works',
  },

  products: {
    workbench: 'WorkBench — LA\'s local services marketplace. Free for customers, vetted providers, direct booking. Currently live and the primary focus.',
    airec: 'AIREC Smart Ads Optimizer — self-correcting AI ad optimization engine. Uses predictive intelligence and real-time feedback loops to optimize campaigns across Google, Meta, TikTok, LinkedIn. Cuts wasted spend by up to 40%. Works with any business spending $10K+/month on ads.',
    diagnostic: 'Industry Diagnostic Intelligence — deep diagnostic engine that scans competitive landscapes, market trends, and industry patterns. Delivers actionable briefs, not 50-page PDFs. Covers tech, SaaS, e-commerce, professional services, real estate, healthcare, and local businesses.',
    command: 'Life & Business Command Console — unified AI-powered command center for business operations, personal productivity, finances, and decision support. Comes opinionated and AI-powered out of the box. Learns your patterns and surfaces what needs attention.',
  },
};

// ─── System Prompts ──────────────────────────────────────────────

function getReceptionistPrompt() {
  const kb = WORKBENCH_KNOWLEDGE;
  return `You are the Novai Systems AI receptionist answering calls at +1 (213) 943-3042. You represent WorkBench — LA's local services marketplace — and Novai Systems as a whole.

## Your Personality
- Warm, professional, direct — no corporate BS
- You're helpful and knowledgeable, not pushy
- Keep responses conversational and concise (this is a phone call, not an essay)
- Use natural speech patterns — contractions, casual phrasing
- If you don't know something specific, say so honestly and offer to connect them with someone who can help

## About WorkBench
${kb.about}

## Service Categories

### Home Services
${kb.services.home.join(', ')}

### Business Services
${kb.services.business.join(', ')}

### Lifestyle Services
${kb.services.lifestyle.join(', ')}

## How It Works
For customers: ${kb.howItWorks.customers.join(' ')}
For providers: ${kb.howItWorks.providers.join(' ')}

## Pricing
- Customers: ${kb.pricing.customers}
- Providers: ${kb.pricing.providers}

## Coverage Area
${kb.coverage}

## What Makes WorkBench Different
${kb.differentiators.join('. ')}.

## About Novai Systems (The Company)
${kb.enterprise.about}
Mission: ${kb.enterprise.mission}
Website: ${kb.enterprise.website}

## All Novai Products
- ${kb.products.workbench}
- ${kb.products.airec}
- ${kb.products.diagnostic}
- ${kb.products.command}

## Your Capabilities
You can:
1. Answer questions about WorkBench services, pricing, coverage, and how it works
2. Help callers find the right service category for their needs
3. Capture lead information (name, email, phone, what they need) for follow-up
4. Schedule a callback or consultation
5. Direct them to the website: workbench.novaisystems.online
6. Transfer to a human team member if needed

## Key Rules
- Always identify yourself: "Hi, this is the Novai Systems line. How can I help you?"
- If someone needs a specific service, help them understand what WorkBench offers and encourage them to check out the website
- If someone wants to become a provider, capture their info and explain the vetting process
- If they ask about pricing for providers, explain it's a fair commission — lower than Thumbtack/Angi — and offer to have someone discuss specifics
- If they need something urgent (emergency plumbing, lockout, etc.), acknowledge the urgency and direct them to the website for immediate booking
- If they want to talk to a human, use the transferCall tool
- If asked about AIREC: explain it's our self-correcting ad optimizer — cuts wasted spend by up to 40%, works across Google/Meta/TikTok/LinkedIn, ideal for businesses spending $10K+/month on ads. Offer to set up a call with the AIREC team.
- If asked about Industry Diagnostic: explain it scans competitive landscapes and delivers actionable intel, not useless dashboards. Works across tech, SaaS, e-commerce, healthcare, local business. Offer to set up a diagnostic.
- If asked about Command Console: explain it's a unified AI command center for business ops, productivity, finances, and decisions — learns your patterns. Built for founders and operators.
- If asked about Novai Systems broadly: we're an LA-based AI company building self-correcting tools powered by AIREC technology. Four products in market. No fluff, just results.
- Always try to capture their name and what they need before the call ends`;
}

function getGTMAgentPrompt(leadContext) {
  const kb = WORKBENCH_KNOWLEDGE;
  const name = leadContext?.customerName || 'there';
  const product = leadContext?.productInterest || 'WorkBench';
  const need = leadContext?.customerNeed || '';

  return `You are the Novai Systems outbound GTM agent calling from +1 (943) 223-9707. You're following up with a lead who expressed interest through our website.

## Who You're Calling
- Name: ${name}
- Interested in: ${product}
- Their need: ${need || 'Not specified'}

## Your Personality
- Warm, genuine, direct — this is a follow-up, not a cold call
- Reference what they told us on the website so they know this is personal
- Be respectful of their time — get to the point
- No hard-sell tactics — you're here to help

## Opening
Start with: "Hey ${name}, this is the Novai team calling — you reached out to us about ${product}. I wanted to follow up personally and see how we can help. Do you have a quick minute?"

If they're busy: "No worries at all — when's a good time for us to call back?"
If they don't remember: "You chatted with our sales agent on the website earlier. You mentioned you were interested in ${product}."

## About WorkBench
${kb.about}

## Service Categories Available
Home: ${kb.services.home.slice(0, 5).join(', ')}, and more.
Business: ${kb.services.business.slice(0, 4).join(', ')}, and more.
Lifestyle: ${kb.services.lifestyle.slice(0, 4).join(', ')}, and more.

## Pricing
- Customers: ${kb.pricing.customers}
- Providers: ${kb.pricing.providers}

## Coverage
${kb.coverage}

## What Makes WorkBench Different
${kb.differentiators.slice(0, 4).join('. ')}.

## Your Goals (in order)
1. Confirm their interest and understand their specific need
2. Answer their questions about WorkBench
3. Get them to visit workbench.novaisystems.online and sign up
4. If they're a potential provider, capture their details for the onboarding team
5. Schedule a follow-up if they need more time

## Your Capabilities
You can:
- Answer any WorkBench question
- Capture additional info (updated needs, preferences)
- Schedule a callback at a specific time
- Direct them to the website

## Key Rules
- Keep the call under 3-4 minutes unless they want to keep talking
- If they're not interested, respect that immediately — "Totally understand, no pressure at all. If you ever need anything, we're at novaisystems.online."
- Always end warmly regardless of outcome`;
}

// ─── Tool Definitions ────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'captureLead',
      description: 'Capture lead information from the caller for follow-up. Use this when the caller provides their name, email, or describes what they need.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Caller name' },
          email: { type: 'string', description: 'Caller email address' },
          phone: { type: 'string', description: 'Caller phone number' },
          need: { type: 'string', description: 'What service or help they need' },
          product: { type: 'string', description: 'Product interest: WorkBench, AIREC, Diagnostic, Command Console, or General' },
          isProvider: { type: 'boolean', description: 'True if caller wants to become a service provider' },
        },
        required: ['name'],
      },
    },
    server: { url: '' }, // Will be set dynamically
  },
  {
    type: 'function',
    function: {
      name: 'lookupService',
      description: 'Look up available services on WorkBench by category or keyword. Use this when a caller asks what services are available or if we cover a specific type of service.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Service type or category to search for (e.g., "plumbing", "cleaning", "personal training")' },
        },
        required: ['query'],
      },
    },
    server: { url: '' },
  },
  {
    type: 'function',
    function: {
      name: 'scheduleCallback',
      description: 'Schedule a callback for the caller at a preferred time. Use when they want to be called back later or need a consultation appointment.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Caller name' },
          phone: { type: 'string', description: 'Phone number to call back' },
          preferredTime: { type: 'string', description: 'When they want to be called back (e.g., "tomorrow morning", "Monday at 2pm", "this afternoon")' },
          reason: { type: 'string', description: 'What the callback is about' },
        },
        required: ['name', 'phone', 'preferredTime'],
      },
    },
    server: { url: '' },
  },
  {
    type: 'function',
    function: {
      name: 'transferCall',
      description: 'Transfer the call to a human team member. Use when the caller explicitly asks to speak with a person or when you cannot adequately address their concern.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred' },
          department: { type: 'string', enum: ['sales', 'support', 'provider-onboarding', 'general'], description: 'Which department to route to' },
        },
        required: ['reason'],
      },
    },
    server: { url: '' },
  },
];

// ─── Service Lookup Logic ────────────────────────────────────────

function lookupService(query) {
  const q = query.toLowerCase();
  const allServices = [
    ...WORKBENCH_KNOWLEDGE.services.home.map(s => ({ service: s, category: 'Home' })),
    ...WORKBENCH_KNOWLEDGE.services.business.map(s => ({ service: s, category: 'Business' })),
    ...WORKBENCH_KNOWLEDGE.services.lifestyle.map(s => ({ service: s, category: 'Lifestyle' })),
  ];

  const matches = allServices.filter(s => s.service.toLowerCase().includes(q));

  if (matches.length > 0) {
    return {
      found: true,
      services: matches.map(m => `${m.service} (${m.category})`),
      message: `Yes! We have ${matches.length} service${matches.length > 1 ? 's' : ''} matching "${query}" on WorkBench.`,
    };
  }

  // Fuzzy match — check if any keywords overlap
  const words = q.split(/\s+/);
  const fuzzy = allServices.filter(s => words.some(w => w.length > 3 && s.service.toLowerCase().includes(w)));

  if (fuzzy.length > 0) {
    return {
      found: true,
      services: fuzzy.map(m => `${m.service} (${m.category})`),
      message: `We found some related services on WorkBench.`,
    };
  }

  return {
    found: false,
    services: [],
    message: `We don't have an exact match for "${query}" yet, but WorkBench is expanding its service categories. I can capture your need and have the team follow up.`,
    suggestion: 'Check workbench.novaisystems.online for the latest available services.',
  };
}

// ─── CORS Headers ────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Main Handler ────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    try {
      const body = await request.json();
      const messageType = body.message?.type;

      // Log incoming webhook
      console.log(`[Vapi Server] Received: ${messageType}`, JSON.stringify(body.message?.type));

      switch (messageType) {
        case 'assistant-request':
          return handleAssistantRequest(body, env);

        case 'tool-calls':
          return handleToolCalls(body, env);

        case 'function-call':
          return handleFunctionCall(body, env);

        case 'end-of-call-report':
          return handleEndOfCallReport(body, env);

        case 'status-update':
          return handleStatusUpdate(body, env);

        default:
          // Acknowledge any other webhook types
          return json({ ok: true });
      }
    } catch (e) {
      console.error('[Vapi Server] Error:', e.message);
      return json({ error: e.message }, 500);
    }
  },
};

// ─── Handler: assistant-request ──────────────────────────────────
// Dynamically provide assistant config based on which number was called

function handleAssistantRequest(body, env) {
  const call = body.message?.call || {};
  const phoneNumberId = call.phoneNumberId;
  const isOutbound = call.type === 'outboundPhoneCall';
  const variableValues = call.assistantOverrides?.variableValues || {};

  // Build server URL for tool callbacks
  const serverUrl = env.VAPI_SERVER_URL || 'https://novai-vapi-server.ajay-solomon.workers.dev';

  // Set tool server URLs
  const tools = TOOLS.map(t => ({
    ...t,
    server: { url: serverUrl },
  }));

  let systemPrompt;
  let firstMessage;

  if (isOutbound) {
    // GTM outbound call — lead follow-up
    systemPrompt = getGTMAgentPrompt(variableValues);
    const name = variableValues.customerName || 'there';
    firstMessage = `Hey ${name}, this is the Novai team calling — you reached out to us about ${variableValues.productInterest || 'our services'}. I wanted to follow up personally. Do you have a quick minute?`;
  } else {
    // Inbound receptionist call
    systemPrompt = getReceptionistPrompt();
    firstMessage = "Hi, this is the Novai Systems line — home of WorkBench, LA's local services marketplace. How can I help you today?";
  }

  const assistant = {
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }],
      tools: tools,
    },
    voice: {
      provider: '11labs',
      voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Lily — warm, professional
    },
    firstMessage: firstMessage,
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
    },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    endCallMessage: "Thanks for calling Novai Systems. Visit workbench.novaisystems.online anytime. Have a great day!",
    serverMessages: [
      'tool-calls',
      'end-of-call-report',
      'status-update',
    ],
  };

  return json({ assistant });
}

// ─── Handler: tool-calls ─────────────────────────────────────────

async function handleToolCalls(body, env) {
  const toolCalls = body.message?.toolCallList || [];
  const results = [];

  for (const toolCall of toolCalls) {
    const fnName = toolCall.function?.name;
    const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};

    let result;

    switch (fnName) {
      case 'captureLead':
        result = await handleCaptureLead(args, body, env);
        break;
      case 'lookupService':
        result = handleLookupService(args);
        break;
      case 'scheduleCallback':
        result = await handleScheduleCallback(args, body, env);
        break;
      case 'transferCall':
        result = handleTransferCall(args);
        break;
      default:
        result = `Unknown function: ${fnName}`;
    }

    results.push({
      toolCallId: toolCall.id,
      result: typeof result === 'string' ? result : JSON.stringify(result),
    });
  }

  return json({ results });
}

// ─── Handler: function-call (legacy format) ──────────────────────

async function handleFunctionCall(body, env) {
  const fn = body.message?.functionCall;
  if (!fn) return json({ result: 'No function call found' });

  const fnName = fn.name;
  const args = fn.parameters || {};

  let result;

  switch (fnName) {
    case 'captureLead':
      result = await handleCaptureLead(args, body, env);
      break;
    case 'lookupService':
      result = handleLookupService(args);
      break;
    case 'scheduleCallback':
      result = await handleScheduleCallback(args, body, env);
      break;
    case 'transferCall':
      result = handleTransferCall(args);
      break;
    default:
      result = `Unknown function: ${fnName}`;
  }

  return json({ result: typeof result === 'string' ? result : JSON.stringify(result) });
}

// ─── Tool Implementations ────────────────────────────────────────

async function handleCaptureLead(args, body, env) {
  const call = body.message?.call || body.call || {};
  const lead = {
    name: args.name || 'Unknown',
    email: args.email || '',
    phone: args.phone || call.customer?.number || '',
    need: args.need || '',
    product: args.product || 'WorkBench',
    isProvider: args.isProvider || false,
    source: call.type === 'outboundPhoneCall' ? 'gtm-outbound-call' : 'inbound-call',
    timestamp: new Date().toISOString(),
    callId: call.id || '',
  };

  // Store in KV if available
  if (env.LEADS) {
    try {
      const existing = JSON.parse(await env.LEADS.get('all_leads') || '[]');
      lead.id = crypto.randomUUID();
      existing.push(lead);
      await env.LEADS.put('all_leads', JSON.stringify(existing));
      await env.LEADS.put(`lead:${lead.id}`, JSON.stringify(lead));
    } catch (e) {
      console.error('[Vapi Server] KV write failed:', e.message);
    }
  }

  console.log('[Vapi Server] Lead captured:', JSON.stringify(lead));

  if (args.isProvider) {
    return `Got it — I've captured ${args.name}'s information as a potential service provider. Our provider onboarding team will reach out to discuss the next steps including our vetting process and commission structure.`;
  }

  return `Perfect, I've captured ${args.name}'s information. ${args.email ? 'We\'ll send a follow-up to ' + args.email + '.' : ''} Our team will follow up shortly to help with ${args.need || 'their request'}.`;
}

function handleLookupService(args) {
  const result = lookupService(args.query || '');
  if (result.found) {
    return `${result.message} Here's what we have: ${result.services.slice(0, 5).join(', ')}${result.services.length > 5 ? ', and more' : ''}. They can browse all options and book directly at workbench.novaisystems.online.`;
  }
  return `${result.message} ${result.suggestion || ''}`;
}

async function handleScheduleCallback(args, body, env) {
  const callback = {
    type: 'callback',
    name: args.name,
    phone: args.phone,
    preferredTime: args.preferredTime,
    reason: args.reason || '',
    timestamp: new Date().toISOString(),
    callId: (body.message?.call || body.call || {}).id || '',
  };

  // Store in KV
  if (env.LEADS) {
    try {
      const callbacks = JSON.parse(await env.LEADS.get('callbacks') || '[]');
      callback.id = crypto.randomUUID();
      callbacks.push(callback);
      await env.LEADS.put('callbacks', JSON.stringify(callbacks));
    } catch (e) {
      console.error('[Vapi Server] Callback save failed:', e.message);
    }
  }

  console.log('[Vapi Server] Callback scheduled:', JSON.stringify(callback));
  return `I've scheduled a callback for ${args.name} at ${args.preferredTime}. We'll call ${args.phone} then. ${args.reason ? 'Noted that this is about: ' + args.reason : ''}`;
}

function handleTransferCall(args) {
  // In production, this would trigger an actual call transfer
  // For now, provide the direct line info
  const dept = args.department || 'general';
  const deptNames = {
    sales: 'sales team',
    support: 'support team',
    'provider-onboarding': 'provider onboarding team',
    general: 'team',
  };

  return `I'll connect you with our ${deptNames[dept] || 'team'} right away. If we get disconnected, you can always call back at +1 (213) 943-3042 or reach us through the website. One moment please.`;
}

// ─── Handler: end-of-call-report ─────────────────────────────────

async function handleEndOfCallReport(body, env) {
  const report = body.message || {};
  const call = report.call || {};

  const summary = {
    callId: call.id,
    type: call.type,
    phoneNumberId: call.phoneNumberId,
    customerNumber: call.customer?.number,
    duration: report.durationSeconds,
    cost: report.cost,
    endedReason: report.endedReason,
    summary: report.summary,
    transcript: report.transcript,
    timestamp: new Date().toISOString(),
  };

  // Store call report in KV
  if (env.LEADS) {
    try {
      const reports = JSON.parse(await env.LEADS.get('call_reports') || '[]');
      reports.push(summary);
      await env.LEADS.put('call_reports', JSON.stringify(reports));
      await env.LEADS.put(`report:${call.id}`, JSON.stringify(summary));
    } catch (e) {
      console.error('[Vapi Server] Report save failed:', e.message);
    }
  }

  console.log('[Vapi Server] Call ended:', call.id, '— Duration:', report.durationSeconds + 's', '— Reason:', report.endedReason);
  return json({ ok: true });
}

// ─── Handler: status-update ──────────────────────────────────────

function handleStatusUpdate(body, env) {
  const status = body.message?.status;
  const callId = body.message?.call?.id;
  console.log(`[Vapi Server] Call ${callId} status: ${status}`);
  return json({ ok: true });
}
