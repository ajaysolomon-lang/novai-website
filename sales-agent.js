(function() {
  'use strict';
  if (document.querySelector('.novai-sales-agent')) return;

  // ─── Product Knowledge Base ───────────────────────────────────────
  var PRODUCTS = {
    airec: {
      name: 'AIREC Smart Ads Optimizer',
      tagline: 'AI that makes every ad dollar count.',
      description: 'Self-correcting ad engine that learns from every impression. No wasted spend. No guesswork. Your campaigns optimize themselves in real-time using predictive intelligence.',
      benefits: [
        'Cut wasted ad spend by up to 40%',
        'Real-time self-correcting optimization loops',
        'Predictive audience targeting that actually works',
        'Works across all major ad platforms'
      ],
      idealFor: 'Businesses burning money on ads that don\'t convert.',
      cta: 'See what AIREC can save you'
    },
    diagnostic: {
      name: 'Industry Diagnostic Intelligence',
      tagline: 'Know your market before your competitors do.',
      description: 'Deep diagnostic engine that scans your industry, competitors, and market position. Gives you the intel you need to make moves — not guesses.',
      benefits: [
        'Real-time competitive intelligence',
        'Market gap identification',
        'Trend prediction before they hit mainstream',
        'Actionable insights, not useless dashboards'
      ],
      idealFor: 'Leaders who want to see around corners.',
      cta: 'Get your industry diagnostic'
    },
    command: {
      name: 'Life & Business Command Console',
      tagline: 'One dashboard to run your entire operation.',
      description: 'Unified command center that brings your business (and life) ops into one place. AI-powered scheduling, task management, financial tracking, and decision support.',
      benefits: [
        'Everything in one place — finally',
        'AI-driven priority management',
        'Financial and operational oversight',
        'Decision support that learns your patterns'
      ],
      idealFor: 'Founders, operators, and people who refuse to drop balls.',
      cta: 'Take command of your operations'
    },
    workbench: {
      name: 'WorkBench',
      tagline: 'LA\'s local services marketplace. Period.',
      description: 'We\'re building the go-to marketplace for local services in Los Angeles. Vetted providers, real reviews, direct booking. No middlemen taking 40% cuts.',
      benefits: [
        'Free for customers — zero catch',
        'Vetted local professionals',
        'Home, business, and lifestyle services',
        'Built for LA, by LA'
      ],
      idealFor: 'Anyone in LA who needs quality service — or wants to provide it.',
      cta: 'Explore WorkBench'
    }
  };

  // ─── Conversation Flows ───────────────────────────────────────────
  var FLOWS = {
    greeting: {
      message: "Hey — I'm the Novai sales agent. No fluff, no pitch decks, no \"let me loop in my manager.\" Just straight answers about what we build and how it helps. What are you looking for?",
      options: [
        { label: 'I need better ad performance', next: 'airec_intro' },
        { label: 'I need market intelligence', next: 'diagnostic_intro' },
        { label: 'I need to organize my operations', next: 'command_intro' },
        { label: 'Tell me about WorkBench', next: 'workbench_intro' },
        { label: 'What does Novai actually do?', next: 'who_we_are' },
        { label: 'I want to talk to someone', next: 'talk_human' }
      ]
    },

    who_we_are: {
      message: "Novai Systems builds AI tools that actually work — not the \"sprinkle AI on it\" kind. We build self-correcting systems with AIREC technology: predictive intelligence that learns, adapts, and delivers results without babysitting.\n\nWe've got four core products. Which one sounds like your world?",
      options: [
        { label: 'AIREC — Ad optimization', next: 'airec_intro' },
        { label: 'Industry Diagnostics — Market intel', next: 'diagnostic_intro' },
        { label: 'Command Console — Operations', next: 'command_intro' },
        { label: 'WorkBench — Local services marketplace', next: 'workbench_intro' }
      ]
    },

    // ── AIREC Flow ──
    airec_intro: {
      message: "AIREC Smart Ads Optimizer — the ad engine that fixes itself.\n\nMost ad tools show you what happened. AIREC predicts what's about to happen and adjusts in real-time. Self-correcting loops mean your campaigns get smarter every hour, not just when you check in.\n\nBusinesses using AIREC cut wasted spend by up to 40%. That's not a promise — it's math.",
      options: [
        { label: 'How does self-correction work?', next: 'airec_deep' },
        { label: 'What platforms does it work with?', next: 'airec_platforms' },
        { label: 'I want in — let\'s talk', next: 'capture_airec' },
        { label: 'Show me other products', next: 'who_we_are' }
      ]
    },
    airec_deep: {
      message: "Every ad impression generates data. Most tools just log it. AIREC runs it through predictive models in real-time, identifies what's working and what's bleeding money, and automatically adjusts targeting, creative weighting, and bid strategy.\n\nNo manual A/B test babysitting. No waiting for \"statistical significance\" while you burn budget. It just works.",
      options: [
        { label: 'What\'s the ROI look like?', next: 'airec_roi' },
        { label: 'Let\'s set up a call', next: 'capture_airec' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    airec_platforms: {
      message: "AIREC works across Google Ads, Meta (Facebook/Instagram), TikTok Ads, LinkedIn, and programmatic platforms. If it has an API, we can optimize it.\n\nOne engine. All your channels. No more juggling five dashboards.",
      options: [
        { label: 'How do I get started?', next: 'capture_airec' },
        { label: 'Tell me more about the tech', next: 'airec_deep' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    airec_roi: {
      message: "Let's keep it real: if you're spending $10K+/month on ads, you're probably wasting 20-40% of it on audiences that'll never convert. AIREC identifies and eliminates that waste — fast.\n\nMost clients see measurable improvement within the first 2 weeks. We don't do long onboarding sagas.",
      options: [
        { label: 'I\'m sold — let\'s talk', next: 'capture_airec' },
        { label: 'Show me other products', next: 'who_we_are' }
      ]
    },

    // ── Diagnostic Flow ──
    diagnostic_intro: {
      message: "Industry Diagnostic Intelligence — see what everyone else is missing.\n\nThis isn't another dashboard with pretty charts and no substance. We scan your competitive landscape, market trends, and industry patterns to give you intel you can actually act on.\n\nThink of it as having a strategist who never sleeps and never misses a signal.",
      options: [
        { label: 'What kind of insights?', next: 'diagnostic_deep' },
        { label: 'What industries do you cover?', next: 'diagnostic_industries' },
        { label: 'I want a diagnostic — let\'s go', next: 'capture_diagnostic' },
        { label: 'Show me other products', next: 'who_we_are' }
      ]
    },
    diagnostic_deep: {
      message: "Competitor moves, market gaps, emerging trends, pricing dynamics, customer sentiment shifts — we surface the signals that matter and filter out the noise.\n\nYou get actionable briefs, not 50-page PDFs that collect dust. Every insight comes with a \"here's what to do about it\" recommendation.",
      options: [
        { label: 'Let\'s set up a diagnostic', next: 'capture_diagnostic' },
        { label: 'What industries?', next: 'diagnostic_industries' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    diagnostic_industries: {
      message: "We work across tech, SaaS, e-commerce, professional services, real estate, healthcare, and local businesses. If your industry has competitors, we can diagnose it.\n\nThe system adapts to your specific vertical — it's not one-size-fits-all generic garbage.",
      options: [
        { label: 'Set up my diagnostic', next: 'capture_diagnostic' },
        { label: 'Tell me more about insights', next: 'diagnostic_deep' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },

    // ── Command Console Flow ──
    command_intro: {
      message: "Life & Business Command Console — because running everything from 12 apps is insane.\n\nOne unified dashboard for your business operations, personal productivity, finances, and decision-making. AI learns your patterns and helps you prioritize what actually matters.\n\nBuilt for founders, operators, and anyone who's tired of context-switching all day.",
      options: [
        { label: 'What does it actually manage?', next: 'command_deep' },
        { label: 'How is this different from Notion/Monday?', next: 'command_vs' },
        { label: 'I need this — let\'s talk', next: 'capture_command' },
        { label: 'Show me other products', next: 'who_we_are' }
      ]
    },
    command_deep: {
      message: "Tasks, scheduling, financial tracking, team coordination, personal goals, client management — all in one place. The AI layer learns how you work and starts surfacing what needs attention before you even ask.\n\nIt's not just organization. It's intelligence applied to your daily operations.",
      options: [
        { label: 'How\'s it different from other tools?', next: 'command_vs' },
        { label: 'Get me set up', next: 'capture_command' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    command_vs: {
      message: "Notion is a blank canvas — great if you want to spend weeks building systems. Monday is project management with a price tag. Neither of them think for you.\n\nCommand Console comes opinionated and AI-powered out of the box. It doesn't just store your data — it analyzes it, spots patterns, and tells you what to focus on. That's the difference.",
      options: [
        { label: 'I\'m in — let\'s go', next: 'capture_command' },
        { label: 'What else do you build?', next: 'who_we_are' }
      ]
    },

    // ── WorkBench Flow ──
    workbench_intro: {
      message: "WorkBench — we're building the local services marketplace Los Angeles actually deserves.\n\nFree for customers. Vetted providers. Home, business, and lifestyle services. No absurd platform fees eating into everyone's margins.\n\nWhether you need a service or you are the service — WorkBench is for you.",
      options: [
        { label: 'I need to find a service provider', next: 'workbench_customer' },
        { label: 'I\'m a service provider — list me', next: 'workbench_provider' },
        { label: 'What services are available?', next: 'workbench_services' },
        { label: 'Show me other products', next: 'who_we_are' }
      ]
    },
    workbench_customer: {
      message: "Simple: sign up for free, browse vetted local pros, book directly. No bidding wars, no mystery pricing, no waiting 3 days for a response.\n\nWe're starting in LA and expanding fast. The marketplace is live now.",
      options: [
        { label: 'Take me to WorkBench', next: 'workbench_link' },
        { label: 'What services are available?', next: 'workbench_services' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    workbench_provider: {
      message: "If you're a service provider in LA, you want to be on WorkBench. We're building the platform where customers actually find and book local pros — not another listing graveyard.\n\nList your services, set your rates, get booked. We don't take ridiculous cuts.",
      options: [
        { label: 'Sign me up as a provider', next: 'workbench_link' },
        { label: 'What\'s it cost for providers?', next: 'workbench_provider_cost' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    workbench_services: {
      message: "Home services (cleaning, repairs, landscaping), business services (consulting, accounting, marketing), and lifestyle services (personal training, beauty, wellness, events).\n\nIf someone in LA offers it, we want it on WorkBench. The goal is to be THE marketplace — not one of many.",
      options: [
        { label: 'Go to WorkBench', next: 'workbench_link' },
        { label: 'I want to list my service', next: 'workbench_provider' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    workbench_provider_cost: {
      message: "We keep it fair. No massive percentage cuts like the big platforms. The details depend on your service category and volume, but the bottom line is: you keep more of what you earn.\n\nSign up and we'll walk you through the specifics for your business.",
      options: [
        { label: 'Sign me up', next: 'workbench_link' },
        { label: 'Back to all products', next: 'who_we_are' }
      ]
    },
    workbench_link: {
      message: "Here you go — WorkBench is live:\n\n→ workbench.novaisystems.online\n\nSign up, browse, book. Welcome to the future of local services in LA.",
      options: [
        { label: 'I have more questions', next: 'who_we_are' },
        { label: 'I want to talk to someone', next: 'talk_human' },
        { label: 'That\'s all — thanks', next: 'close_thanks' }
      ],
      link: 'https://workbench.novaisystems.online/'
    },

    // ── Lead Capture Flows ──
    capture_airec: {
      message: "Smart move. Drop your details and we'll get back to you fast — no week-long email chains, no \"discovery call\" gatekeeping. Just a real conversation about what AIREC can do for your ads.",
      capture: true,
      product: 'AIREC Smart Ads Optimizer',
      options: []
    },
    capture_diagnostic: {
      message: "Let's get you that diagnostic. Drop your info and we'll set up a time to dig into your market — fast.",
      capture: true,
      product: 'Industry Diagnostic Intelligence',
      options: []
    },
    capture_command: {
      message: "Let's get you set up with Command Console. Drop your details — we move quick.",
      capture: true,
      product: 'Life & Business Command Console',
      options: []
    },

    // ── Talk to Human ──
    talk_human: {
      message: "No gatekeepers here. Reach us directly:\n\n📞  +1 (213) 943-3042\n\nOr drop your info and we'll reach out to you — usually same day.",
      capture: true,
      product: 'General Inquiry',
      options: []
    },

    // ── Objection Handling ──
    objection_price: {
      message: "Here's the thing — you're already spending money. On tools that half-work, on agencies that bill by the hour, on guesswork that costs you opportunities.\n\nNovai isn't an expense. It's the thing that stops the bleeding. Let's talk numbers specific to your situation.",
      options: [
        { label: 'Fair point — let\'s talk', next: 'talk_human' },
        { label: 'Show me the products again', next: 'who_we_are' }
      ]
    },
    objection_already_have: {
      message: "Respect. But ask yourself: is it actually working? If your current tools were delivering, you probably wouldn't be here.\n\nWe're not asking you to rip and replace. We're saying: let us show you what you're missing. If we can't beat what you've got, we'll say so.",
      options: [
        { label: 'Alright, show me what you\'ve got', next: 'who_we_are' },
        { label: 'Let\'s set up a comparison call', next: 'talk_human' }
      ]
    },
    objection_think: {
      message: "Take your time — but know that your competitors aren't waiting. Every day without the right tools is a day you're leaving money and market share on the table.\n\nNo pressure. But when you're ready, we're here. And we move fast.",
      options: [
        { label: 'Actually, let\'s talk now', next: 'talk_human' },
        { label: 'Show me the products one more time', next: 'who_we_are' },
        { label: 'I\'ll be back', next: 'close_thanks' }
      ]
    },

    // ── Close ──
    close_thanks: {
      message: "Respect. You know where to find us — novaisystems.online. When you're ready to stop settling for average tools, we'll be here.\n\nNovai Systems. Built different.",
      options: [
        { label: 'Start over', next: 'greeting' }
      ]
    },

    // ── After Lead Capture ──
    capture_success: {
      message: "Got it. We'll be in touch — expect to hear from us fast. No automated drip campaigns, no \"thanks for your interest\" fluff. A real person, a real conversation.\n\nAnything else while you're here?",
      options: [
        { label: 'Tell me about other products', next: 'who_we_are' },
        { label: 'That\'s all — thanks', next: 'close_thanks' }
      ]
    }
  };

  // ─── State ────────────────────────────────────────────────────────
  var state = {
    isOpen: false,
    currentFlow: 'greeting',
    messages: [],
    capturedLeads: []
  };

  // ─── Build DOM ────────────────────────────────────────────────────
  var container = document.createElement('div');
  container.className = 'novai-sales-agent';

  // Toggle button
  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'novai-sa-toggle';
  toggleBtn.setAttribute('aria-label', 'Open sales agent chat');
  toggleBtn.innerHTML =
    '<svg class="novai-sa-icon-chat" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>' +
    '</svg>' +
    '<svg class="novai-sa-icon-close" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  // Chat panel
  var panel = document.createElement('div');
  panel.className = 'novai-sa-panel';
  panel.innerHTML =
    '<div class="novai-sa-header">' +
      '<div class="novai-sa-header-info">' +
        '<div class="novai-sa-avatar">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' +
        '</div>' +
        '<div>' +
          '<strong class="novai-sa-title">Novai Sales</strong>' +
          '<span class="novai-sa-status">Online — no wait times</span>' +
        '</div>' +
      '</div>' +
      '<button class="novai-sa-minimize" aria-label="Minimize chat">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="novai-sa-messages"></div>' +
    '<div class="novai-sa-options"></div>';

  container.appendChild(panel);
  container.appendChild(toggleBtn);

  // ─── Inject Styles ────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    ':root{--novai-primary:#0a2540;--novai-accent:#0077ff;--novai-accent2:#00bbff;--novai-bg:#0d1117;--novai-panel:#161b22;--novai-surface:#1c2333;--novai-border:rgba(255,255,255,.08);--novai-text:#e6edf3;--novai-text-dim:rgba(255,255,255,.5);--novai-radius:16px}' +

    '.novai-sales-agent{position:fixed;bottom:24px;right:24px;z-index:99999;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +

    /* Toggle button */
    '.novai-sa-toggle{width:60px;height:60px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--novai-accent),var(--novai-accent2));color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,119,255,.4);transition:transform .2s,box-shadow .2s;position:relative}' +
    '.novai-sa-toggle:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(0,119,255,.5)}' +
    '.novai-sa-toggle .novai-sa-icon-close{display:none}' +
    '.novai-sales-agent.is-open .novai-sa-toggle .novai-sa-icon-chat{display:none}' +
    '.novai-sales-agent.is-open .novai-sa-toggle .novai-sa-icon-close{display:block}' +

    /* Pulse animation on toggle */
    '.novai-sa-toggle::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:linear-gradient(135deg,var(--novai-accent),var(--novai-accent2));opacity:.3;animation:novai-pulse 2s ease-in-out infinite}' +
    '.novai-sales-agent.is-open .novai-sa-toggle::before{display:none}' +
    '@keyframes novai-pulse{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.15);opacity:0}}' +

    /* Panel */
    '.novai-sa-panel{position:absolute;bottom:72px;right:0;width:380px;max-height:560px;background:var(--novai-bg);border:1px solid var(--novai-border);border-radius:var(--novai-radius);box-shadow:0 16px 64px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;transition:opacity .25s,transform .25s}' +
    '.novai-sales-agent.is-open .novai-sa-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}' +

    /* Header */
    '.novai-sa-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,var(--novai-primary),#0f2f52);border-bottom:1px solid var(--novai-border)}' +
    '.novai-sa-header-info{display:flex;align-items:center;gap:12px}' +
    '.novai-sa-avatar{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--novai-accent),var(--novai-accent2));display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}' +
    '.novai-sa-title{display:block;font-size:14px;font-weight:700;color:#fff}' +
    '.novai-sa-status{display:block;font-size:11px;color:var(--novai-accent2);font-weight:500}' +
    '.novai-sa-minimize{background:none;border:none;color:var(--novai-text-dim);cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '.novai-sa-minimize:hover{background:rgba(255,255,255,.1)}' +

    /* Messages area */
    '.novai-sa-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;min-height:200px;max-height:340px}' +
    '.novai-sa-messages::-webkit-scrollbar{width:4px}' +
    '.novai-sa-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}' +

    /* Message bubbles */
    '.novai-sa-msg{padding:12px 16px;border-radius:14px;font-size:13.5px;line-height:1.55;color:var(--novai-text);max-width:92%;white-space:pre-wrap;animation:novai-fadeIn .3s ease}' +
    '.novai-sa-msg.agent{background:var(--novai-surface);border:1px solid var(--novai-border);align-self:flex-start;border-bottom-left-radius:4px}' +
    '.novai-sa-msg.user{background:linear-gradient(135deg,var(--novai-accent),#005ec4);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '@keyframes novai-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +

    /* Options area */
    '.novai-sa-options{padding:12px 20px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--novai-border);background:var(--novai-bg)}' +
    '.novai-sa-opt{padding:10px 16px;background:var(--novai-surface);border:1px solid var(--novai-border);border-radius:12px;color:var(--novai-text);font-size:13px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s,border-color .15s,transform .1s;font-family:inherit}' +
    '.novai-sa-opt:hover{background:rgba(0,119,255,.12);border-color:rgba(0,119,255,.3);transform:translateX(4px)}' +
    '.novai-sa-opt:active{transform:translateX(2px)}' +

    /* Lead capture form */
    '.novai-sa-form{padding:12px 20px 16px;border-top:1px solid var(--novai-border);background:var(--novai-bg);display:flex;flex-direction:column;gap:8px}' +
    '.novai-sa-form input,.novai-sa-form textarea{width:100%;padding:10px 14px;background:var(--novai-surface);border:1px solid var(--novai-border);border-radius:10px;color:var(--novai-text);font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}' +
    '.novai-sa-form input:focus,.novai-sa-form textarea:focus{border-color:var(--novai-accent)}' +
    '.novai-sa-form input::placeholder,.novai-sa-form textarea::placeholder{color:var(--novai-text-dim)}' +
    '.novai-sa-form textarea{resize:none;height:60px}' +
    '.novai-sa-form button{padding:10px 20px;background:linear-gradient(135deg,var(--novai-accent),var(--novai-accent2));color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s;font-family:inherit}' +
    '.novai-sa-form button:hover{opacity:.9}' +
    '.novai-sa-form button:disabled{opacity:.5;cursor:not-allowed}' +

    /* Objection buttons row */
    '.novai-sa-objections{display:flex;gap:6px;flex-wrap:wrap;padding:0 20px 8px}' +
    '.novai-sa-objection{font-size:11px;padding:6px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:20px;color:var(--novai-text-dim);cursor:pointer;transition:all .15s;font-family:inherit}' +
    '.novai-sa-objection:hover{background:rgba(255,255,255,.08);color:var(--novai-text)}' +

    /* Typing indicator */
    '.novai-sa-typing{display:flex;gap:4px;padding:12px 16px;align-self:flex-start}' +
    '.novai-sa-typing span{width:6px;height:6px;border-radius:50%;background:var(--novai-text-dim);animation:novai-typing .6s ease-in-out infinite}' +
    '.novai-sa-typing span:nth-child(2){animation-delay:.15s}' +
    '.novai-sa-typing span:nth-child(3){animation-delay:.3s}' +
    '@keyframes novai-typing{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}' +

    /* Mobile responsive */
    '@media(max-width:480px){' +
      '.novai-sa-panel{width:calc(100vw - 32px);right:-8px;bottom:68px;max-height:70vh}' +
      '.novai-sa-toggle{width:52px;height:52px}' +
      '.novai-sales-agent{bottom:16px;right:16px}' +
    '}' +

    /* Notification badge */
    '.novai-sa-badge{position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:#ff3b3b;border-radius:50%;border:2px solid var(--novai-bg);animation:novai-fadeIn .3s ease}' +
    '.novai-sales-agent.is-open .novai-sa-badge{display:none}';

  document.head.appendChild(style);

  // ─── Render Functions ─────────────────────────────────────────────
  function getMessagesEl() { return panel.querySelector('.novai-sa-messages'); }
  function getOptionsEl() { return panel.querySelector('.novai-sa-options'); }

  function addMessage(text, sender) {
    var messagesEl = getMessagesEl();
    var msg = document.createElement('div');
    msg.className = 'novai-sa-msg ' + sender;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    state.messages.push({ text: text, sender: sender });
  }

  function showTyping() {
    var messagesEl = getMessagesEl();
    var typing = document.createElement('div');
    typing.className = 'novai-sa-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return typing;
  }

  function renderFlow(flowKey) {
    state.currentFlow = flowKey;
    var flow = FLOWS[flowKey];
    if (!flow) return;

    var optionsEl = getOptionsEl();

    // Clear previous options/forms
    optionsEl.innerHTML = '';
    var existingForm = panel.querySelector('.novai-sa-form');
    if (existingForm) existingForm.remove();
    var existingObjections = panel.querySelector('.novai-sa-objections');
    if (existingObjections) existingObjections.remove();

    // Show typing, then message
    var typing = showTyping();
    var delay = Math.min(40 * flow.message.length, 1200);
    delay = Math.max(delay, 400);

    setTimeout(function() {
      typing.remove();
      addMessage(flow.message, 'agent');

      // If this flow has a link, auto-open it
      if (flow.link) {
        setTimeout(function() {
          window.open(flow.link, '_blank', 'noopener');
        }, 500);
      }

      // Show capture form or options
      if (flow.capture) {
        renderCaptureForm(flow.product);
      } else {
        renderOptions(flow.options);
        // Show objection buttons on product intros
        if (flowKey.indexOf('_intro') !== -1) {
          renderObjections();
        }
      }
    }, delay);
  }

  function renderOptions(options) {
    var optionsEl = getOptionsEl();
    optionsEl.innerHTML = '';
    options.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.className = 'novai-sa-opt';
      btn.textContent = opt.label;
      btn.addEventListener('click', function() {
        addMessage(opt.label, 'user');
        renderFlow(opt.next);
      });
      optionsEl.appendChild(btn);
    });
  }

  function renderObjections() {
    var existing = panel.querySelector('.novai-sa-objections');
    if (existing) existing.remove();

    var row = document.createElement('div');
    row.className = 'novai-sa-objections';

    var objections = [
      { label: 'Seems expensive...', next: 'objection_price' },
      { label: 'I already have tools', next: 'objection_already_have' },
      { label: 'Need to think about it', next: 'objection_think' }
    ];

    objections.forEach(function(obj) {
      var btn = document.createElement('button');
      btn.className = 'novai-sa-objection';
      btn.textContent = obj.label;
      btn.addEventListener('click', function() {
        addMessage(obj.label, 'user');
        row.remove();
        renderFlow(obj.next);
      });
      row.appendChild(btn);
    });

    var optionsEl = getOptionsEl();
    optionsEl.parentNode.insertBefore(row, optionsEl);
  }

  function renderCaptureForm(product) {
    var optionsEl = getOptionsEl();
    optionsEl.innerHTML = '';

    var form = document.createElement('div');
    form.className = 'novai-sa-form';
    form.innerHTML =
      '<input type="text" placeholder="Your name" class="novai-sa-name" autocomplete="name">' +
      '<input type="email" placeholder="Email" class="novai-sa-email" autocomplete="email">' +
      '<input type="tel" placeholder="Phone (optional)" class="novai-sa-phone" autocomplete="tel">' +
      '<textarea placeholder="What do you need? (optional)" class="novai-sa-need"></textarea>' +
      '<button class="novai-sa-submit">Send it →</button>';

    panel.appendChild(form);

    var submitBtn = form.querySelector('.novai-sa-submit');
    submitBtn.addEventListener('click', function() {
      var name = form.querySelector('.novai-sa-name').value.trim();
      var email = form.querySelector('.novai-sa-email').value.trim();
      var phone = form.querySelector('.novai-sa-phone').value.trim();
      var need = form.querySelector('.novai-sa-need').value.trim();

      if (!name || !email) {
        // Brief shake animation
        form.style.animation = 'novai-shake .3s ease';
        setTimeout(function() { form.style.animation = ''; }, 300);
        return;
      }

      // Basic email validation
      if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
        form.querySelector('.novai-sa-email').style.borderColor = '#ff3b3b';
        return;
      }

      var lead = {
        name: name,
        email: email,
        phone: phone,
        need: need,
        product: product,
        timestamp: new Date().toISOString(),
        page: window.location.href
      };

      state.capturedLeads.push(lead);

      // Store in localStorage for persistence
      try {
        var stored = JSON.parse(localStorage.getItem('novai_leads') || '[]');
        stored.push(lead);
        localStorage.setItem('novai_leads', JSON.stringify(stored));
      } catch(e) {}

      // Also submit to intake form if it exists on the page
      submitToIntakeForm(lead);

      // Send to GTM outbound worker (triggers Vapi outbound call if phone provided)
      submitToGTMWorker(lead);

      // Log for analytics
      console.log('[Novai Sales Agent] Lead captured:', lead);

      // Remove form and show success
      form.remove();
      addMessage('Name: ' + name + '\nEmail: ' + email + (phone ? '\nPhone: ' + phone : '') + (need ? '\nNeed: ' + need : ''), 'user');
      renderFlow('capture_success');
    });
  }

  function submitToIntakeForm(lead) {
    // If there's an existing form on the page, populate and submit
    var pageForm = document.querySelector('.intake form, form[action]');
    if (pageForm) {
      var nameInput = pageForm.querySelector('input[placeholder*="Name"], input[name="name"]');
      var emailInput = pageForm.querySelector('input[placeholder*="Email"], input[name="email"]');
      var needInput = pageForm.querySelector('textarea');
      if (nameInput) nameInput.value = lead.name;
      if (emailInput) emailInput.value = lead.email;
      if (needInput) needInput.value = '[' + lead.product + '] ' + (lead.need || 'Interested - contacted via sales agent');
    }
  }

  // ─── GTM Outbound Worker Integration ───────────────────────────
  var GTM_WORKER_URL = 'https://novai-gtm-outbound.ajay-solomon.workers.dev';

  function submitToGTMWorker(lead) {
    try {
      var payload = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        need: lead.need || '',
        product: lead.product || 'General',
        source: 'sales-agent',
        page: lead.page || window.location.href,
        timestamp: lead.timestamp
      };

      fetch(GTM_WORKER_URL + '/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(res) {
        return res.json();
      }).then(function(data) {
        if (data.success) {
          console.log('[Novai GTM] Lead synced. ID:', data.leadId);
          if (data.outboundCall && data.outboundCall.success) {
            console.log('[Novai GTM] Outbound call initiated. Call ID:', data.outboundCall.callId);
          }
        }
      }).catch(function(err) {
        console.warn('[Novai GTM] Worker sync failed (lead saved locally):', err.message);
      });
    } catch(e) {
      // Fail silently — localStorage is the fallback
    }
  }

  // ─── Toggle Chat ──────────────────────────────────────────────────
  function toggleChat() {
    state.isOpen = !state.isOpen;
    if (state.isOpen) {
      container.classList.add('is-open');
      toggleBtn.setAttribute('aria-label', 'Close sales agent chat');
      // Remove badge
      var badge = toggleBtn.querySelector('.novai-sa-badge');
      if (badge) badge.remove();
      // Start conversation if fresh
      if (state.messages.length === 0) {
        renderFlow('greeting');
      }
    } else {
      container.classList.remove('is-open');
      toggleBtn.setAttribute('aria-label', 'Open sales agent chat');
    }
  }

  toggleBtn.addEventListener('click', toggleChat);
  panel.querySelector('.novai-sa-minimize').addEventListener('click', toggleChat);

  // ─── Auto-open Logic ──────────────────────────────────────────────
  function shouldAutoOpen() {
    try {
      var lastDismissed = localStorage.getItem('novai_sa_dismissed');
      if (lastDismissed) {
        var hoursSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60);
        if (hoursSince < 24) return false;
      }
    } catch(e) {}
    return true;
  }

  // Show notification badge after 3 seconds
  setTimeout(function() {
    if (!state.isOpen) {
      var badge = document.createElement('div');
      badge.className = 'novai-sa-badge';
      toggleBtn.appendChild(badge);
    }
  }, 3000);

  // Auto-open after 8 seconds if not dismissed recently
  setTimeout(function() {
    if (!state.isOpen && shouldAutoOpen()) {
      toggleChat();
      try {
        localStorage.setItem('novai_sa_dismissed', Date.now().toString());
      } catch(e) {}
    }
  }, 8000);

  // ─── Add shake keyframe ──────────────────────────────────────────
  var shakeStyle = document.createElement('style');
  shakeStyle.textContent = '@keyframes novai-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
  document.head.appendChild(shakeStyle);

  // ─── Mount ────────────────────────────────────────────────────────
  document.body.appendChild(container);
})();
