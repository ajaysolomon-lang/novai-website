const WIDGET_HTML = `
<div style="position:fixed;bottom:92px;right:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="https://workbench.novaisystems.online/" target="_blank" rel="noopener"
     style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,#1a1f36,#252b45);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.4);text-decoration:none;transition:transform .2s,box-shadow .2s"
     onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,100,255,.25)'"
     onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0,0,0,.4)'">
    <span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#0077ff,#00bbff);border-radius:10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    </span>
    <span style="display:flex;flex-direction:column;gap:2px">
      <strong style="font-size:14px;font-weight:700;color:#fff">WorkBench</strong>
      <small style="font-size:11px;color:rgba(255,255,255,.5)">Local Services Marketplace</small>
    </span>
  </a>
</div>`;

// Sales agent injection tag — loads as external script to avoid CSP inline blocks
const SALES_AGENT_TAG = `<script src="/_wb-sales-agent.js" defer><\/script>`;

// ─── Sales Agent JS (served as external file at /_wb-sales-agent.js) ───
const SALES_AGENT_CODE = `(function() {
  'use strict';
  if (document.querySelector('.wb-sales-agent')) return;

  // ─── Conversation Flows ───────────────────────────────────────────
  var FLOWS = {
    greeting: {
      message: "Hey \\u2014 welcome to WorkBench. I'm here to help you find the right local service or get your business listed. No runaround, just straight answers. What are you looking for?",
      options: [
        { label: 'I need to find a service provider', next: 'customer_start' },
        { label: 'I want to list my services', next: 'provider_start' },
        { label: 'What is WorkBench exactly?', next: 'what_is_wb' },
        { label: 'What services are available?', next: 'customer_start' },
        { label: 'Tell me about Novai Systems', next: 'about_novai' },
        { label: 'I want to talk to someone', next: 'talk_human' }
      ]
    },

    what_is_wb: {
      message: "WorkBench is LA's local services marketplace \\u2014 built by Novai Systems.\\n\\nWe connect you with vetted, trusted service providers for home, business, and lifestyle needs. Free to use as a customer. No bidding wars, no mystery pricing, no middlemen taking 40% cuts.\\n\\nWhether you need a service or you are the service \\u2014 this is your platform.",
      options: [
        { label: 'I need a service provider', next: 'customer_start' },
        { label: 'I want to list my services', next: 'provider_start' },
        { label: 'What areas do you serve?', next: 'areas_served' },
        { label: 'Is it really free?', next: 'pricing_customer' }
      ]
    },

    customer_start: {
      message: "Nice \\u2014 let's find you the right pro. What kind of service do you need?",
      options: [
        { label: 'Home services (repairs, cleaning, landscaping)', next: 'cat_home' },
        { label: 'Business services (consulting, accounting, marketing)', next: 'cat_business' },
        { label: 'Lifestyle (personal training, beauty, wellness)', next: 'cat_lifestyle' },
        { label: 'Something else', next: 'cat_other' }
      ]
    },

    cat_home: {
      message: "Home services \\u2014 we've got you covered. Plumbing, electrical, HVAC, cleaning, landscaping, handyman work, painting, moving \\u2014 the whole range.\\n\\nBrowse our providers, check their profiles, and book directly. No middleman markups.",
      options: [
        { label: 'Browse home services now', next: 'browse_services' },
        { label: 'How do I know they\\'re vetted?', next: 'vetting_process' },
        { label: 'What does it cost me?', next: 'pricing_customer' },
        { label: 'I need a different category', next: 'customer_start' }
      ]
    },

    cat_business: {
      message: "Business services \\u2014 consulting, bookkeeping, accounting, legal, marketing, IT support, design, web development. Local pros who understand the LA market.\\n\\nNo agencies billing you $300/hour for junior work. Real professionals, transparent rates.",
      options: [
        { label: 'Browse business services', next: 'browse_services' },
        { label: 'How are providers vetted?', next: 'vetting_process' },
        { label: 'What does it cost?', next: 'pricing_customer' },
        { label: 'Different category', next: 'customer_start' }
      ]
    },

    cat_lifestyle: {
      message: "Lifestyle services \\u2014 personal trainers, beauty pros, wellness coaches, event planners, photographers, tutors. The people who make life in LA actually work.\\n\\nAll on one platform. Browse, compare, book.",
      options: [
        { label: 'Browse lifestyle services', next: 'browse_services' },
        { label: 'How vetted are they?', next: 'vetting_process' },
        { label: 'Pricing?', next: 'pricing_customer' },
        { label: 'Different category', next: 'customer_start' }
      ]
    },

    cat_other: {
      message: "No problem \\u2014 if someone in LA offers it, we probably have it or we're adding it. Tell me what you need and I'll point you in the right direction.\\n\\nOr browse the full services directory \\u2014 you might find exactly what you're looking for.",
      options: [
        { label: 'Browse all services', next: 'browse_services' },
        { label: 'Tell you what I need', next: 'capture_customer' },
        { label: 'Go back to categories', next: 'customer_start' }
      ]
    },

    browse_services: {
      message: "Head to the Services page to browse and book directly. You can filter by category, location, and availability.\\n\\nIf you don't have an account yet, sign up takes 30 seconds \\u2014 and it's free.",
      options: [
        { label: 'Go to Services', next: 'link_services' },
        { label: 'Sign me up first', next: 'link_signup' },
        { label: 'I have more questions', next: 'greeting' }
      ]
    },

    link_services: {
      message: "Here you go:",
      link: '/services',
      linkText: 'Browse Services',
      options: [
        { label: 'How does booking work?', next: 'how_booking' },
        { label: 'I have other questions', next: 'greeting' }
      ]
    },

    link_signup: {
      message: "Quick and free \\u2014 just need your name and email to get started:",
      link: '/signup',
      linkText: 'Create Your Account',
      options: [
        { label: 'What happens after I sign up?', next: 'after_signup_customer' },
        { label: 'Back to main menu', next: 'greeting' }
      ]
    },

    after_signup_customer: {
      message: "Once you're in, you can browse the full directory, view provider profiles and reviews, and book services directly. No approval process, no waiting. You're in immediately.\\n\\nYou can also save favorite providers and get notified when new pros join in categories you care about.",
      options: [
        { label: 'Sign me up', next: 'link_signup' },
        { label: 'More questions', next: 'greeting' }
      ]
    },

    how_booking: {
      message: "Simple: find a provider, check their profile and rates, and book directly through the platform. You deal with the provider directly \\u2014 WorkBench just makes the connection.\\n\\nNo platform fees on your end. The provider sets their rates, you see exactly what you'll pay.",
      options: [
        { label: 'Browse services', next: 'link_services' },
        { label: 'Other questions', next: 'greeting' }
      ]
    },

    vetting_process: {
      message: "Every provider on WorkBench goes through verification. We check credentials, reviews, and legitimacy before they go live on the platform.\\n\\nWe're not a free-for-all listing site. Quality matters \\u2014 that's why people come to WorkBench instead of scrolling through random search results and hoping for the best.",
      options: [
        { label: 'Good enough \\u2014 show me services', next: 'browse_services' },
        { label: 'What if I have a bad experience?', next: 'bad_experience' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    bad_experience: {
      message: "Reach out to us directly. We take quality seriously \\u2014 if a provider doesn't deliver, we want to know. We'll help resolve it and, if necessary, remove providers who don't meet standards.\\n\\nThis isn't Craigslist. We stand behind the marketplace.",
      options: [
        { label: 'Good to know \\u2014 browse services', next: 'browse_services' },
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    pricing_customer: {
      message: "Free. Zero. Nothing.\\n\\nSigning up, browsing, and booking on WorkBench is completely free for customers. No subscription, no hidden fees, no \\"premium tier\\" to unlock basic features.\\n\\nYou pay the service provider directly for their work. That's it.",
      options: [
        { label: 'Sign me up', next: 'link_signup' },
        { label: 'Browse services', next: 'browse_services' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    areas_served: {
      message: "WorkBench currently serves the greater Los Angeles area \\u2014 our launch market. We're expanding fast, but right now LA is where we're focused and where we deliver the best experience.\\n\\nIf you're in LA, you're covered.",
      options: [
        { label: 'Find services in my area', next: 'browse_services' },
        { label: 'When are you expanding?', next: 'expansion' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    expansion: {
      message: "Soon. We're building the foundation right in LA first \\u2014 getting the quality, the providers, and the experience locked in. Once that's solid, we scale.\\n\\nWant to be first to know when we hit your area? Drop your info and we'll keep you posted.",
      options: [
        { label: 'Notify me about expansion', next: 'capture_expansion' },
        { label: 'I\\'m in LA \\u2014 let\\'s go', next: 'browse_services' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    provider_start: {
      message: "Smart move. If you're a service provider in LA, WorkBench is where your next customers are finding you \\u2014 not buried on page 3 of Google.\\n\\nWhat kind of services do you offer?",
      options: [
        { label: 'Home services', next: 'provider_home' },
        { label: 'Business services', next: 'provider_business' },
        { label: 'Lifestyle services', next: 'provider_lifestyle' },
        { label: 'How much does listing cost?', next: 'pricing_provider' },
        { label: 'Why should I list here?', next: 'why_list' }
      ]
    },

    provider_home: {
      message: "Home services are in high demand on WorkBench \\u2014 cleaning, repairs, plumbing, electrical, landscaping, painting, HVAC, handyman. LA homeowners and renters are actively looking.\\n\\nList your services, set your rates, get booked. You control your schedule and your pricing.",
      options: [
        { label: 'Sign up as a provider', next: 'link_provider_signup' },
        { label: 'What does it cost me?', next: 'pricing_provider' },
        { label: 'How do customers find me?', next: 'how_discovery' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    provider_business: {
      message: "Business services \\u2014 consulting, accounting, legal, marketing, design, IT, development. Local businesses in LA need local expertise, and they're looking on WorkBench.\\n\\nSet up your profile, showcase your work, and let customers come to you.",
      options: [
        { label: 'Sign up as a provider', next: 'link_provider_signup' },
        { label: 'Listing costs?', next: 'pricing_provider' },
        { label: 'How do I get found?', next: 'how_discovery' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    provider_lifestyle: {
      message: "Lifestyle services are booming \\u2014 personal training, beauty, wellness, photography, event planning, tutoring. LA lives for this. And WorkBench puts you right in front of people who are ready to book.\\n\\nNo competing with mega-platforms that bury small providers.",
      options: [
        { label: 'Sign up as a provider', next: 'link_provider_signup' },
        { label: 'What\\'s the cost?', next: 'pricing_provider' },
        { label: 'How are customers finding me?', next: 'how_discovery' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    link_provider_signup: {
      message: "Let's get you listed. Sign up takes a few minutes \\u2014 set up your profile, add your services and rates, and you're live:",
      link: '/signup',
      linkText: 'Sign Up as a Provider',
      options: [
        { label: 'What happens after I sign up?', next: 'after_signup_provider' },
        { label: 'More questions first', next: 'provider_start' }
      ]
    },

    after_signup_provider: {
      message: "You create your profile, add your services with descriptions and pricing, and go through our verification process. Once approved, you're live on the marketplace.\\n\\nCustomers can find you by searching, browsing categories, or getting matched based on their needs. You get notified when someone's interested, and you manage bookings directly.",
      options: [
        { label: 'Let\\'s do it', next: 'link_provider_signup' },
        { label: 'How long is verification?', next: 'verification_time' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    verification_time: {
      message: "We move fast. Verification is typically completed within a few business days. We're not trying to gatekeep \\u2014 we just need to make sure providers are legit and customers can trust the marketplace.\\n\\nOnce you're verified, you're live immediately.",
      options: [
        { label: 'Sign me up', next: 'link_provider_signup' },
        { label: 'Other questions', next: 'provider_start' }
      ]
    },

    pricing_provider: {
      message: "We keep it fair. No massive percentage cuts like the big platforms. WorkBench is built to help providers keep more of what they earn \\u2014 not to extract value from every transaction.\\n\\nThe specifics depend on your service category and volume. Sign up and we'll walk you through it \\u2014 no surprises.",
      options: [
        { label: 'Fair enough \\u2014 sign me up', next: 'link_provider_signup' },
        { label: 'How is this different from other platforms?', next: 'why_list' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    why_list: {
      message: "Real talk: most platforms bury small providers, charge absurd fees, and treat you like inventory. WorkBench is built different.\\n\\n- You set your own rates\\n- You keep more of what you earn\\n- You get discovered by local customers who are actually ready to book\\n- No competing against mega-companies with infinite ad budgets\\n- Built specifically for LA \\u2014 not a generic national platform\\n\\nThis is your marketplace. Not theirs.",
      options: [
        { label: 'Sold \\u2014 let me sign up', next: 'link_provider_signup' },
        { label: 'How do customers find me?', next: 'how_discovery' },
        { label: 'Still thinking...', next: 'objection_think' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    how_discovery: {
      message: "Customers find you through:\\n\\n- Direct search on WorkBench (by service type, category, location)\\n- Browsing the services directory\\n- Our recommendation matching (we surface relevant providers based on what customers need)\\n- SEO \\u2014 WorkBench ranks for local service searches in LA\\n\\nYou don't need to run ads or hustle for visibility. The platform does the work.",
      options: [
        { label: 'Let\\'s get started', next: 'link_provider_signup' },
        { label: 'Back to provider info', next: 'provider_start' },
        { label: 'Back to main', next: 'greeting' }
      ]
    },

    objection_think: {
      message: "Take your time. But every day you're not listed is a day customers in LA are finding someone else.\\n\\nSigning up is free and takes minutes. You can see how it works before committing to anything. No lock-in, no contracts.\\n\\nWhen you're ready \\u2014 we're here.",
      options: [
        { label: 'Alright, let me try it', next: 'link_provider_signup' },
        { label: 'Tell me more about WorkBench', next: 'what_is_wb' },
        { label: 'I\\'ll be back', next: 'close_thanks' }
      ]
    },

    about_novai: {
      message: "WorkBench is built by Novai Systems LLC \\u2014 an AI and technology company based in Los Angeles.\\n\\nNovai builds intelligent systems: multi-agent architectures, AI engines, and platforms designed for real-world impact. WorkBench is our local services marketplace \\u2014 bringing that same engineering quality to connecting people with trusted service providers.\\n\\nWant to know more about what Novai does?",
      options: [
        { label: 'What else does Novai build?', next: 'novai_products' },
        { label: 'Visit Novai Systems website', next: 'link_novai' },
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    novai_products: {
      message: "Novai Systems builds enterprise AI solutions:\\n\\n- AIREC Smart Ads Optimizer \\u2014 self-correcting ad engine with predictive intelligence\\n- Industry Diagnostic Intelligence \\u2014 competitive analysis and market insights\\n- Life & Business Command Console \\u2014 unified operations dashboard\\n- WorkBench \\u2014 the local services marketplace you're on right now\\n\\nAll powered by AIREC technology: self-correcting loops and predictive intelligence.",
      options: [
        { label: 'Visit novaisystems.online', next: 'link_novai' },
        { label: 'Contact Novai Systems', next: 'talk_human' },
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    link_novai: {
      message: "Check out the full Novai Systems story here:",
      externalLink: 'https://novaisystems.online/',
      linkText: 'Visit Novai Systems',
      options: [
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    capture_customer: {
      message: "Tell us what you need \\u2014 we'll help match you with the right provider. Drop your details and we'll get back to you fast.",
      capture: true,
      product: 'WorkBench \\u2014 Customer Request',
      options: []
    },

    capture_expansion: {
      message: "Drop your email and we'll notify you when WorkBench launches in your area. No spam \\u2014 just the heads-up.",
      capture: true,
      product: 'WorkBench \\u2014 Expansion Interest',
      options: []
    },

    talk_human: {
      message: "No gatekeepers. Reach us directly:\\n\\n+1 (213) 943-3042\\n\\nOr drop your info and we'll reach out \\u2014 usually same day.",
      capture: true,
      product: 'WorkBench \\u2014 Direct Contact',
      options: []
    },

    close_thanks: {
      message: "All good. You know where to find us \\u2014 workbench.novaisystems.online. When you're ready, we'll be here.\\n\\nWorkBench by Novai Systems. Local services, done right.",
      options: [
        { label: 'Start over', next: 'greeting' }
      ]
    },

    capture_success: {
      message: "Got it. We'll be in touch fast \\u2014 no automated drip campaigns, just a real response.\\n\\nAnything else?",
      options: [
        { label: 'Browse services', next: 'link_services' },
        { label: 'Learn more about WorkBench', next: 'what_is_wb' },
        { label: 'That\\'s all \\u2014 thanks', next: 'close_thanks' }
      ]
    }
  };

  var state = {
    isOpen: false,
    currentFlow: 'greeting',
    messages: [],
    capturedLeads: []
  };

  var container = document.createElement('div');
  container.className = 'wb-sales-agent';

  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'wb-sa-toggle';
  toggleBtn.setAttribute('aria-label', 'Open WorkBench assistant');
  toggleBtn.innerHTML =
    '<svg class="wb-sa-icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>' +
    '</svg>' +
    '<svg class="wb-sa-icon-close" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  var panel = document.createElement('div');
  panel.className = 'wb-sa-panel';
  panel.innerHTML =
    '<div class="wb-sa-header">' +
      '<div class="wb-sa-header-info">' +
        '<div class="wb-sa-avatar">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>' +
        '</div>' +
        '<div>' +
          '<strong class="wb-sa-title">WorkBench</strong>' +
          '<span class="wb-sa-status">Online \\u2014 here to help</span>' +
        '</div>' +
      '</div>' +
      '<button class="wb-sa-minimize" aria-label="Minimize">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="wb-sa-messages"></div>' +
    '<div class="wb-sa-options"></div>';

  container.appendChild(panel);
  container.appendChild(toggleBtn);

  var style = document.createElement('style');
  style.textContent =
    ':root{--wb-accent:#0077ff;--wb-accent2:#00bbff;--wb-bg:#0d1117;--wb-panel:#161b22;--wb-surface:#1c2333;--wb-border:rgba(255,255,255,.08);--wb-text:#e6edf3;--wb-text-dim:rgba(255,255,255,.5);--wb-radius:16px}' +
    '.wb-sales-agent{position:fixed;bottom:24px;right:24px;z-index:99999;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '.wb-sa-toggle{width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--wb-accent),var(--wb-accent2));color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,119,255,.4);transition:transform .2s,box-shadow .2s;position:relative}' +
    '.wb-sa-toggle:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(0,119,255,.5)}' +
    '.wb-sa-toggle .wb-sa-icon-close{display:none}' +
    '.wb-sales-agent.is-open .wb-sa-toggle .wb-sa-icon-chat{display:none}' +
    '.wb-sales-agent.is-open .wb-sa-toggle .wb-sa-icon-close{display:block}' +
    '.wb-sa-toggle::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:linear-gradient(135deg,var(--wb-accent),var(--wb-accent2));opacity:.3;animation:wb-pulse 2s ease-in-out infinite}' +
    '.wb-sales-agent.is-open .wb-sa-toggle::before{display:none}' +
    '@keyframes wb-pulse{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.15);opacity:0}}' +
    '.wb-sa-panel{position:absolute;bottom:68px;right:0;width:370px;max-height:540px;background:var(--wb-bg);border:1px solid var(--wb-border);border-radius:var(--wb-radius);box-shadow:0 16px 64px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;transition:opacity .25s,transform .25s}' +
    '.wb-sales-agent.is-open .wb-sa-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}' +
    '.wb-sa-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,#0a2540,#0f2f52);border-bottom:1px solid var(--wb-border)}' +
    '.wb-sa-header-info{display:flex;align-items:center;gap:10px}' +
    '.wb-sa-avatar{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--wb-accent),var(--wb-accent2));display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}' +
    '.wb-sa-title{display:block;font-size:14px;font-weight:700;color:#fff}' +
    '.wb-sa-status{display:block;font-size:11px;color:var(--wb-accent2);font-weight:500}' +
    '.wb-sa-minimize{background:none;border:none;color:var(--wb-text-dim);cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '.wb-sa-minimize:hover{background:rgba(255,255,255,.1)}' +
    '.wb-sa-messages{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;min-height:180px;max-height:320px}' +
    '.wb-sa-messages::-webkit-scrollbar{width:4px}' +
    '.wb-sa-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}' +
    '.wb-sa-msg{padding:11px 15px;border-radius:14px;font-size:13px;line-height:1.55;color:var(--wb-text);max-width:92%;white-space:pre-wrap;animation:wb-fadeIn .3s ease}' +
    '.wb-sa-msg.agent{background:var(--wb-surface);border:1px solid var(--wb-border);align-self:flex-start;border-bottom-left-radius:4px}' +
    '.wb-sa-msg.user{background:linear-gradient(135deg,var(--wb-accent),#005ec4);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '@keyframes wb-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
    '.wb-sa-link{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:8px 16px;background:linear-gradient(135deg,var(--wb-accent),var(--wb-accent2));color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;transition:opacity .15s}' +
    '.wb-sa-link:hover{opacity:.9}' +
    '.wb-sa-options{padding:10px 18px 14px;display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--wb-border);background:var(--wb-bg);max-height:220px;overflow-y:auto}' +
    '.wb-sa-opt{padding:9px 14px;background:var(--wb-surface);border:1px solid var(--wb-border);border-radius:11px;color:var(--wb-text);font-size:12.5px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s,border-color .15s,transform .1s;font-family:inherit}' +
    '.wb-sa-opt:hover{background:rgba(0,119,255,.12);border-color:rgba(0,119,255,.3);transform:translateX(4px)}' +
    '.wb-sa-opt:active{transform:translateX(2px)}' +
    '.wb-sa-form{padding:10px 18px 14px;border-top:1px solid var(--wb-border);background:var(--wb-bg);display:flex;flex-direction:column;gap:7px}' +
    '.wb-sa-form input,.wb-sa-form textarea{width:100%;padding:9px 12px;background:var(--wb-surface);border:1px solid var(--wb-border);border-radius:10px;color:var(--wb-text);font-size:12.5px;font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}' +
    '.wb-sa-form input:focus,.wb-sa-form textarea:focus{border-color:var(--wb-accent)}' +
    '.wb-sa-form input::placeholder,.wb-sa-form textarea::placeholder{color:var(--wb-text-dim)}' +
    '.wb-sa-form textarea{resize:none;height:56px}' +
    '.wb-sa-form button{padding:9px 18px;background:linear-gradient(135deg,var(--wb-accent),var(--wb-accent2));color:#fff;border:none;border-radius:10px;font-size:12.5px;font-weight:600;cursor:pointer;transition:opacity .15s;font-family:inherit}' +
    '.wb-sa-form button:hover{opacity:.9}' +
    '.wb-sa-form button:disabled{opacity:.5;cursor:not-allowed}' +
    '.wb-sa-typing{display:flex;gap:4px;padding:11px 15px;align-self:flex-start}' +
    '.wb-sa-typing span{width:5px;height:5px;border-radius:50%;background:var(--wb-text-dim);animation:wb-typing .6s ease-in-out infinite}' +
    '.wb-sa-typing span:nth-child(2){animation-delay:.15s}' +
    '.wb-sa-typing span:nth-child(3){animation-delay:.3s}' +
    '@keyframes wb-typing{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}' +
    '.wb-sa-badge{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#ff3b3b;border-radius:50%;border:2px solid var(--wb-bg);animation:wb-fadeIn .3s ease}' +
    '.wb-sales-agent.is-open .wb-sa-badge{display:none}' +
    '@media(max-width:480px){.wb-sa-panel{width:calc(100vw - 32px);right:-8px;bottom:64px;max-height:70vh}.wb-sa-toggle{width:50px;height:50px}.wb-sales-agent{bottom:16px;right:16px}}' +
    '@keyframes wb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';

  document.head.appendChild(style);

  function getMessagesEl() { return panel.querySelector('.wb-sa-messages'); }
  function getOptionsEl() { return panel.querySelector('.wb-sa-options'); }

  function addMessage(text, sender, linkData) {
    var messagesEl = getMessagesEl();
    var msg = document.createElement('div');
    msg.className = 'wb-sa-msg ' + sender;
    msg.textContent = text;
    if (linkData && sender === 'agent') {
      var link = document.createElement('a');
      link.className = 'wb-sa-link';
      link.textContent = linkData.text + ' \\u2192';
      link.href = linkData.url;
      if (linkData.external) { link.target = '_blank'; link.rel = 'noopener'; }
      msg.appendChild(document.createElement('br'));
      msg.appendChild(link);
    }
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    state.messages.push({ text: text, sender: sender });
  }

  function showTyping() {
    var messagesEl = getMessagesEl();
    var typing = document.createElement('div');
    typing.className = 'wb-sa-typing';
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
    optionsEl.innerHTML = '';
    var existingForm = panel.querySelector('.wb-sa-form');
    if (existingForm) existingForm.remove();
    var typing = showTyping();
    var delay = Math.min(35 * flow.message.length, 1000);
    delay = Math.max(delay, 350);
    setTimeout(function() {
      typing.remove();
      var linkData = null;
      if (flow.link) {
        linkData = { url: flow.link, text: flow.linkText || 'Go', external: false };
      } else if (flow.externalLink) {
        linkData = { url: flow.externalLink, text: flow.linkText || 'Visit', external: true };
      }
      addMessage(flow.message, 'agent', linkData);
      if (flow.capture) {
        renderCaptureForm(flow.product);
      } else {
        renderOptions(flow.options);
      }
    }, delay);
  }

  function renderOptions(options) {
    var optionsEl = getOptionsEl();
    optionsEl.innerHTML = '';
    options.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.className = 'wb-sa-opt';
      btn.textContent = opt.label;
      btn.addEventListener('click', function() {
        addMessage(opt.label, 'user');
        renderFlow(opt.next);
      });
      optionsEl.appendChild(btn);
    });
  }

  function renderCaptureForm(product) {
    var optionsEl = getOptionsEl();
    optionsEl.innerHTML = '';
    var form = document.createElement('div');
    form.className = 'wb-sa-form';
    form.innerHTML =
      '<input type="text" placeholder="Your name" class="wb-sa-name" autocomplete="name">' +
      '<input type="email" placeholder="Email" class="wb-sa-email" autocomplete="email">' +
      '<input type="tel" placeholder="Phone (optional)" class="wb-sa-phone" autocomplete="tel">' +
      '<textarea placeholder="What do you need? (optional)" class="wb-sa-need"></textarea>' +
      '<button class="wb-sa-submit">Send it</button>';
    panel.appendChild(form);
    var submitBtn = form.querySelector('.wb-sa-submit');
    submitBtn.addEventListener('click', function() {
      var name = form.querySelector('.wb-sa-name').value.trim();
      var email = form.querySelector('.wb-sa-email').value.trim();
      var phone = form.querySelector('.wb-sa-phone').value.trim();
      var need = form.querySelector('.wb-sa-need').value.trim();
      if (!name || !email) {
        form.style.animation = 'wb-shake .3s ease';
        setTimeout(function() { form.style.animation = ''; }, 300);
        return;
      }
      if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
        form.querySelector('.wb-sa-email').style.borderColor = '#ff3b3b';
        return;
      }
      var lead = {
        name: name, email: email, phone: phone, need: need,
        product: product, timestamp: new Date().toISOString(), page: window.location.href
      };
      state.capturedLeads.push(lead);
      try {
        var stored = JSON.parse(localStorage.getItem('wb_leads') || '[]');
        stored.push(lead);
        localStorage.setItem('wb_leads', JSON.stringify(stored));
      } catch(e) {}
      console.log('[WorkBench Sales Agent] Lead captured:', lead);
      form.remove();
      addMessage('Name: ' + name + '\\nEmail: ' + email + (phone ? '\\nPhone: ' + phone : '') + (need ? '\\nRe: ' + need : ''), 'user');
      renderFlow('capture_success');
    });
  }

  function toggleChat() {
    state.isOpen = !state.isOpen;
    if (state.isOpen) {
      container.classList.add('is-open');
      toggleBtn.setAttribute('aria-label', 'Close WorkBench assistant');
      var badge = toggleBtn.querySelector('.wb-sa-badge');
      if (badge) badge.remove();
      if (state.messages.length === 0) { renderFlow('greeting'); }
    } else {
      container.classList.remove('is-open');
      toggleBtn.setAttribute('aria-label', 'Open WorkBench assistant');
    }
  }

  toggleBtn.addEventListener('click', toggleChat);
  panel.querySelector('.wb-sa-minimize').addEventListener('click', toggleChat);

  setTimeout(function() {
    if (!state.isOpen) {
      var badge = document.createElement('div');
      badge.className = 'wb-sa-badge';
      toggleBtn.appendChild(badge);
    }
  }, 3000);

  setTimeout(function() {
    if (state.isOpen) return;
    try {
      var last = localStorage.getItem('wb_sa_dismissed');
      if (last && (Date.now() - parseInt(last)) / 3600000 < 24) return;
    } catch(e) {}
    toggleChat();
    try { localStorage.setItem('wb_sa_dismissed', Date.now().toString()); } catch(e) {}
  }, 10000);

  document.body.appendChild(container);
})();`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isWorkbench = url.hostname === "workbench.novaisystems.online";

    // Serve the sales agent JS as an external file (bypasses CSP inline-script blocks)
    if (isWorkbench && url.pathname === "/_wb-sales-agent.js") {
      return new Response(SALES_AGENT_CODE, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Debug endpoint — shows what the worker sees
    if (isWorkbench && url.pathname === "/_wb-debug") {
      const testRes = await fetch(new Request(url.origin + "/", {
        headers: request.headers,
        redirect: "manual"
      }));
      const info = {
        worker: "novai-widget-injector",
        hostname: url.hostname,
        isWorkbench,
        originStatus: testRes.status,
        originContentType: testRes.headers.get("content-type"),
        originCSP: testRes.headers.get("content-security-policy"),
        originHeaders: Object.fromEntries(testRes.headers.entries())
      };
      return new Response(JSON.stringify(info, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;

    // Remove CSP headers that might block our external script
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("content-security-policy");
    newHeaders.delete("content-security-policy-report-only");

    const newRes = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders
    });

    return new HTMLRewriter()
      .on("body", {
        element(el) {
          // WorkBench widget only on the main site (not on workbench itself)
          if (!isWorkbench) {
            el.append(WIDGET_HTML, { html: true });
          }
          // Sales agent on WorkBench — loaded as external script to avoid CSP issues
          if (isWorkbench) {
            el.append(SALES_AGENT_TAG, { html: true });
          }
        }
      })
      .transform(newRes);
  }
};
