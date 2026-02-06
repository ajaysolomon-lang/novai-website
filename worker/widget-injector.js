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
  console.log('[WorkBench Agent] Loaded');
  if (document.querySelector('.wb-sales-agent')) return;

  // ─── Conversation Flows ───────────────────────────────────────────
  // GTM Strategy: every path → signup, browse, or lead capture
  // Support paths → discovery moments → deeper engagement
  var FLOWS = {

    // ── GREETING ──
    greeting: {
      message: "What's up! I'm your WorkBench guide \\u2014 whether you need a local pro, want to grow your business, or have questions. How can I help?",
      options: [
        { label: 'I need a service provider', next: 'customer_start' },
        { label: 'I want to list my services', next: 'provider_start' },
        { label: 'How does WorkBench work?', next: 'how_it_works' },
        { label: 'I need help with my account', next: 'support_menu' },
        { label: 'Pricing questions', next: 'pricing_overview' },
        { label: 'Talk to someone', next: 'talk_human' }
      ]
    },

    // ── HOW IT WORKS ──
    how_it_works: {
      message: "WorkBench connects you with vetted local service providers in LA. Think of it as your neighborhood marketplace \\u2014 minus the sketchy Craigslist vibes.\\n\\nFor customers: Browse, compare, book directly. No fees on your end.\\n\\nFor providers: List your services, set your rates, get discovered by people who actually need what you offer.\\n\\nSimple as that.",
      options: [
        { label: 'Find a service', next: 'customer_start' },
        { label: 'Get listed as a provider', next: 'provider_start' },
        { label: 'How are providers vetted?', next: 'vetting' },
        { label: 'What makes WorkBench different?', next: 'differentiator' }
      ]
    },

    differentiator: {
      message: "Real talk? Most platforms charge insane fees, bury small providers, or have zero quality control.\\n\\nWorkBench is different:\\n\\n\\u2022 Vetted providers only \\u2014 no random listings\\n\\u2022 Fair pricing \\u2014 providers keep more\\n\\u2022 Zero fees for customers\\n\\u2022 Built for LA first \\u2014 we know this market\\n\\u2022 Real support from real people\\n\\nWe\\u2019re not trying to be everything everywhere. We\\u2019re building the best local services marketplace in LA.",
      options: [
        { label: 'Sign me up', next: 'signup_choice' },
        { label: 'Browse services', next: 'link_services' },
        { label: 'How do you vet providers?', next: 'vetting' },
        { label: 'Back to start', next: 'greeting' }
      ]
    },

    // ── CUSTOMER FLOWS (acquisition) ──
    customer_start: {
      message: "Let\\u2019s find your person. What kind of service do you need?",
      options: [
        { label: 'Home (repairs, cleaning, landscaping)', next: 'cat_home' },
        { label: 'Business (consulting, accounting, IT)', next: 'cat_business' },
        { label: 'Lifestyle (training, beauty, wellness)', next: 'cat_lifestyle' },
        { label: 'Something else', next: 'cat_other' }
      ]
    },

    cat_home: {
      message: "Home services \\u2014 plumbing, electrical, HVAC, cleaning, landscaping, handyman, painting, moving. All vetted, all on WorkBench.\\n\\nNo more calling 5 people and hoping one shows up.",
      options: [
        { label: 'Browse home services', next: 'link_services' },
        { label: 'How much does it cost?', next: 'pricing_customer' },
        { label: 'Sign me up', next: 'link_signup_customer' },
        { label: 'Different category', next: 'customer_start' }
      ]
    },

    cat_business: {
      message: "Business services \\u2014 accounting, legal, marketing, design, IT, consulting, web dev. Local pros who get the LA market.\\n\\nSkip the agency markup. Work directly with the people doing the work.",
      options: [
        { label: 'Browse business services', next: 'link_services' },
        { label: 'Pricing?', next: 'pricing_customer' },
        { label: 'Sign me up', next: 'link_signup_customer' },
        { label: 'Different category', next: 'customer_start' }
      ]
    },

    cat_lifestyle: {
      message: "Lifestyle services \\u2014 personal trainers, beauty pros, wellness coaches, photographers, tutors, event planners. LA at its finest.\\n\\nAll on one platform. Browse, book, done.",
      options: [
        { label: 'Browse lifestyle services', next: 'link_services' },
        { label: 'Pricing?', next: 'pricing_customer' },
        { label: 'Sign me up', next: 'link_signup_customer' },
        { label: 'Different category', next: 'customer_start' }
      ]
    },

    cat_other: {
      message: "If it\\u2019s a service in LA, we probably have it or we\\u2019re adding it fast. Browse the full directory or tell me what you need \\u2014 I\\u2019ll point you right.",
      options: [
        { label: 'Browse all services', next: 'link_services' },
        { label: 'Tell you what I need', next: 'capture_customer' },
        { label: 'Back to categories', next: 'customer_start' }
      ]
    },

    // ── PROVIDER FLOWS (supply-side acquisition) ──
    provider_start: {
      message: "Smart. If you\\u2019re a service pro in LA, this is your platform. What do you do?",
      options: [
        { label: 'Home services', next: 'provider_home' },
        { label: 'Business services', next: 'provider_biz' },
        { label: 'Lifestyle services', next: 'provider_life' },
        { label: 'How much does it cost to list?', next: 'pricing_provider' },
        { label: 'Why should I list here?', next: 'why_list' }
      ]
    },

    provider_home: {
      message: "Home services are in demand \\u2014 cleaning, repairs, plumbing, electrical, HVAC, landscaping, painting, moving. LA homeowners are actively looking.\\n\\nSet your rates. Control your schedule. Get booked.",
      options: [
        { label: 'Sign up as a provider', next: 'link_signup_provider' },
        { label: 'What\\u2019s the cost?', next: 'pricing_provider' },
        { label: 'How will customers find me?', next: 'discovery' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    provider_biz: {
      message: "Business services \\u2014 consulting, accounting, legal, marketing, design, IT, dev. Local businesses want local experts, not faceless agencies.\\n\\nShow your work. Set your terms. Let clients come to you.",
      options: [
        { label: 'Sign up', next: 'link_signup_provider' },
        { label: 'Cost?', next: 'pricing_provider' },
        { label: 'How do clients find me?', next: 'discovery' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    provider_life: {
      message: "Lifestyle is booming in LA \\u2014 trainers, beauty, wellness, photography, events, tutoring. People are ready to book.\\n\\nNo competing with corporate chains. This is the local marketplace.",
      options: [
        { label: 'Sign up', next: 'link_signup_provider' },
        { label: 'Cost?', next: 'pricing_provider' },
        { label: 'How do I get found?', next: 'discovery' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    why_list: {
      message: "Most platforms treat providers like inventory. High fees, buried in search, competing against companies with infinite ad budgets.\\n\\nWorkBench flips that:\\n\\n\\u2022 Set your own rates\\n\\u2022 Keep more of what you earn\\n\\u2022 Get discovered by locals ready to book\\n\\u2022 No ad spend required\\n\\u2022 Built for LA \\u2014 not a generic nationwide platform\\n\\nYour skills, your business, your marketplace.",
      options: [
        { label: 'I\\u2019m in \\u2014 sign me up', next: 'link_signup_provider' },
        { label: 'How do customers find me?', next: 'discovery' },
        { label: 'Still thinking...', next: 'objection_think' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    discovery: {
      message: "Customers find you through:\\n\\n\\u2022 Search by service type and location\\n\\u2022 Browsing the directory\\n\\u2022 Our matching recommendations\\n\\u2022 SEO \\u2014 we rank for LA service searches\\n\\nNo ads needed. The platform brings customers to you.",
      options: [
        { label: 'Let\\u2019s go', next: 'link_signup_provider' },
        { label: 'Back to provider info', next: 'provider_start' },
        { label: 'Back to start', next: 'greeting' }
      ]
    },

    objection_think: {
      message: "Take your time. But every day you\\u2019re not listed, someone in LA is finding a different provider.\\n\\nFree to sign up. No lock-in. See how it works before committing.\\n\\nWhen you\\u2019re ready \\u2014 we\\u2019re here.",
      options: [
        { label: 'Alright, let me try', next: 'link_signup_provider' },
        { label: 'More about WorkBench', next: 'how_it_works' },
        { label: 'I\\u2019ll come back', next: 'close_thanks' }
      ]
    },

    // ── PRICING ──
    pricing_overview: {
      message: "Quick breakdown:\\n\\nCustomers: Completely free. Browse, book, done. You pay the provider directly. No platform fees.\\n\\nProviders: Fair and transparent. No massive percentage cuts. Sign up to see details for your service category.",
      options: [
        { label: 'Sign up as a customer', next: 'link_signup_customer' },
        { label: 'Sign up as a provider', next: 'link_signup_provider' },
        { label: 'How is this sustainable?', next: 'sustainable' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    pricing_customer: {
      message: "Free. No subscription, no hidden fees, no \\"premium tier\\" BS.\\n\\nYou browse, you book, you pay the provider directly. WorkBench doesn\\u2019t touch your wallet.",
      options: [
        { label: 'Sign me up', next: 'link_signup_customer' },
        { label: 'Browse services', next: 'link_services' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    pricing_provider: {
      message: "We keep it fair. No 30-40% cuts like the big platforms. WorkBench is built for providers to actually earn.\\n\\nThe exact rate depends on your service category and volume. Sign up and we\\u2019ll walk you through it \\u2014 no surprises, no lock-in.",
      options: [
        { label: 'Fair enough \\u2014 sign me up', next: 'link_signup_provider' },
        { label: 'Why is this better?', next: 'why_list' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    sustainable: {
      message: "Fair question. We take a small service fee from providers \\u2014 way less than what other platforms charge.\\n\\nOur model works because we focus on quality over quantity, and we\\u2019re growing sustainably in LA first. No VC burn-rate race. Just building something that works.",
      options: [
        { label: 'Makes sense \\u2014 sign me up', next: 'signup_choice' },
        { label: 'Tell me about the company', next: 'about_novai' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    // ── TRUST & VETTING ──
    vetting: {
      message: "Every provider goes through verification. We check credentials, reviews, and legitimacy before anyone goes live.\\n\\nThis isn\\u2019t a free-for-all listing site. Quality is the whole point. That\\u2019s why people trust WorkBench over random Google results.",
      options: [
        { label: 'Show me services', next: 'link_services' },
        { label: 'What if I have a bad experience?', next: 'bad_experience' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    bad_experience: {
      message: "Contact us directly. We take quality seriously. If a provider doesn\\u2019t deliver, we handle it \\u2014 resolution, refund assistance, and if needed, removal.\\n\\nWe stand behind every listing on this platform.",
      options: [
        { label: 'Browse services', next: 'link_services' },
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    // ── SUPPORT FLOWS ──
    support_menu: {
      message: "I\\u2019ve got you. What do you need help with?",
      options: [
        { label: 'How to book a service', next: 'help_booking' },
        { label: 'My account or profile', next: 'help_account' },
        { label: 'Payments & payouts', next: 'help_payments' },
        { label: 'Job status or issues', next: 'help_jobs' },
        { label: 'ID verification', next: 'help_verification' },
        { label: 'Something else', next: 'talk_human' }
      ]
    },

    help_booking: {
      message: "Find a provider on the Services page, check their profile and rates, and book directly. You deal with them directly \\u2014 WorkBench makes the connection.\\n\\nNeed help finding the right service?",
      options: [
        { label: 'Browse services', next: 'link_services' },
        { label: 'Other help', next: 'support_menu' },
        { label: 'Back to start', next: 'greeting' }
      ]
    },

    help_account: {
      message: "Head to your Profile page to update your info, change settings, or manage your account.\\n\\nIf something\\u2019s broken, reach out \\u2014 we\\u2019ll fix it.",
      options: [
        { label: 'Go to Profile', next: 'link_profile' },
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Back', next: 'support_menu' }
      ]
    },

    help_payments: {
      message: "Customers: You pay providers directly. No surprise charges from WorkBench.\\n\\nProviders: Payouts are processed through your dashboard. Check the Payouts section for status and history.\\n\\nStill stuck?",
      options: [
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Go to Dashboard', next: 'link_dashboard' },
        { label: 'Back', next: 'support_menu' }
      ]
    },

    help_jobs: {
      message: "Check your Dashboard for job status, active bookings, and updates. Everything\\u2019s tracked there.\\n\\nIf something\\u2019s off with a job, reach out directly.",
      options: [
        { label: 'Go to Dashboard', next: 'link_dashboard' },
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Back', next: 'support_menu' }
      ]
    },

    help_verification: {
      message: "ID verification is part of our provider vetting process. Typically takes a few business days. We need to make sure every provider is legit.\\n\\nSubmitted docs and haven\\u2019t heard back? Reach out \\u2014 we\\u2019ll check on it.",
      options: [
        { label: 'Contact support', next: 'talk_human' },
        { label: 'Back', next: 'support_menu' }
      ]
    },

    // ── ABOUT NOVAI ──
    about_novai: {
      message: "WorkBench is by Novai Systems \\u2014 an AI and tech company based in LA.\\n\\nWe build intelligent systems: multi-agent architectures, predictive engines, and platforms built for real impact. WorkBench brings that engineering DNA to local services.",
      options: [
        { label: 'What else does Novai build?', next: 'novai_products' },
        { label: 'Visit Novai Systems', next: 'link_novai' },
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    novai_products: {
      message: "Novai Systems builds:\\n\\n\\u2022 AIREC Smart Ads Optimizer \\u2014 self-correcting ad intelligence\\n\\u2022 Industry Diagnostic Intelligence \\u2014 competitive analysis\\n\\u2022 Life & Business Command Console \\u2014 unified operations\\n\\u2022 WorkBench \\u2014 the marketplace you\\u2019re on now\\n\\nAll powered by AIREC technology: self-correcting loops and predictive intelligence.",
      options: [
        { label: 'Visit novaisystems.online', next: 'link_novai' },
        { label: 'Contact Novai', next: 'talk_human' },
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    // ── NAVIGATION LINKS ──
    signup_choice: {
      message: "Who are you signing up as?",
      options: [
        { label: 'Customer \\u2014 I need services', next: 'link_signup_customer' },
        { label: 'Provider \\u2014 I offer services', next: 'link_signup_provider' }
      ]
    },

    link_services: {
      message: "Here\\u2019s the services directory:",
      link: '/services',
      linkText: 'Browse Services',
      options: [
        { label: 'How does booking work?', next: 'help_booking' },
        { label: 'Back to start', next: 'greeting' }
      ]
    },

    link_signup_customer: {
      message: "Quick and free \\u2014 30 seconds to get started:",
      link: '/signup',
      linkText: 'Create Free Account',
      options: [
        { label: 'What happens after signup?', next: 'after_signup_customer' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    link_signup_provider: {
      message: "Set up your profile and start getting discovered:",
      link: '/signup',
      linkText: 'Get Listed on WorkBench',
      options: [
        { label: 'What\\u2019s the process?', next: 'after_signup_provider' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    link_profile: {
      message: "Manage your account here:",
      link: '/profile',
      linkText: 'Go to Profile',
      options: [
        { label: 'More help', next: 'support_menu' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    link_dashboard: {
      message: "Your jobs, bookings, and activity:",
      link: '/dashboard',
      linkText: 'Go to Dashboard',
      options: [
        { label: 'More help', next: 'support_menu' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    link_novai: {
      message: "The full Novai Systems story:",
      externalLink: 'https://novaisystems.online/',
      linkText: 'Visit Novai Systems',
      options: [
        { label: 'Back to WorkBench', next: 'greeting' }
      ]
    },

    // ── POST-SIGNUP INFO ──
    after_signup_customer: {
      message: "You\\u2019re in immediately. Browse the full directory, check provider profiles and reviews, book directly. No approval wait.\\n\\nSave favorites, get notified when new pros join categories you care about.",
      options: [
        { label: 'Sign me up', next: 'link_signup_customer' },
        { label: 'More questions', next: 'greeting' }
      ]
    },

    after_signup_provider: {
      message: "Create your profile, add services with descriptions and pricing, go through our quick verification. Once approved, you\\u2019re live.\\n\\nCustomers find you through search, categories, and our matching. You manage bookings from your dashboard.",
      options: [
        { label: 'Let\\u2019s do it', next: 'link_signup_provider' },
        { label: 'How long is verification?', next: 'verification_time' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    verification_time: {
      message: "Few business days, max. We move fast \\u2014 just need to make sure everything checks out. Once verified, you\\u2019re live immediately.",
      options: [
        { label: 'Sign me up', next: 'link_signup_provider' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    // ── AREAS ──
    areas_served: {
      message: "WorkBench currently serves the greater Los Angeles area \\u2014 our launch market. We\\u2019re expanding, but LA is where we deliver the best experience right now.\\n\\nIf you\\u2019re in LA, you\\u2019re covered.",
      options: [
        { label: 'Find services in LA', next: 'link_services' },
        { label: 'When are you expanding?', next: 'expansion' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    expansion: {
      message: "Soon. Building the foundation right in LA first \\u2014 quality, providers, experience locked in. Then we scale.\\n\\nWant to know when we hit your area? Drop your info.",
      options: [
        { label: 'Notify me', next: 'capture_expansion' },
        { label: 'I\\u2019m in LA \\u2014 let\\u2019s go', next: 'link_services' },
        { label: 'Back', next: 'greeting' }
      ]
    },

    // ── LEAD CAPTURE ──
    capture_customer: {
      message: "Tell us what you need \\u2014 we\\u2019ll match you with the right provider. Quick details:",
      capture: true,
      product: 'WorkBench \\u2014 Service Request',
      options: []
    },

    capture_expansion: {
      message: "Drop your email and we\\u2019ll notify you when WorkBench launches in your area. No spam \\u2014 just the heads-up.",
      capture: true,
      product: 'WorkBench \\u2014 Expansion Interest',
      options: []
    },

    talk_human: {
      message: "Real people, no gatekeepers:\\n\\n\\u260E +1 (213) 943-3042 \\u2014 Human team\\n\\u{1F916} +1 (943) 223-9707 \\u2014 AI Voice Agent (24/7)\\n\\nOr drop your details \\u2014 we\\u2019ll reach out, usually same day.",
      capture: true,
      product: 'WorkBench \\u2014 Contact Request',
      options: []
    },

    // ── CLOSE ──
    close_thanks: {
      message: "All good. workbench.novaisystems.online \\u2014 we\\u2019re here when you\\u2019re ready.\\n\\nWorkBench by Novai Systems.",
      options: [
        { label: 'Start over', next: 'greeting' }
      ]
    },

    capture_success: {
      message: "Locked in. We\\u2019ll be in touch fast \\u2014 no drip campaigns, just a real reply.\\n\\nAnything else?",
      options: [
        { label: 'Browse services', next: 'link_services' },
        { label: 'Learn more', next: 'how_it_works' },
        { label: 'That\\u2019s all \\u2014 thanks', next: 'close_thanks' }
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
  container.className = 'wb-sales-agent';

  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'wb-sa-toggle';
  toggleBtn.setAttribute('aria-label', 'Chat with WorkBench');
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
          '<span class="wb-sa-status">\\u2022 Online</span>' +
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

  // ─── Styles ─────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    ':root{--wb-accent:#0077ff;--wb-accent2:#00bbff;--wb-bg:#0d1117;--wb-surface:#1c2333;--wb-border:rgba(255,255,255,.08);--wb-text:#e6edf3;--wb-text-dim:rgba(255,255,255,.5);--wb-radius:16px}' +

    '.wb-sales-agent{position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +

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
    '.wb-sa-status{display:block;font-size:11px;color:#3fb950;font-weight:500}' +
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

    // Voice call button styles
    '.wb-voice-btn{position:absolute;bottom:66px;right:0;width:44px;height:44px;border-radius:50%;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(16,185,129,.4);transition:transform .2s,box-shadow .2s,background .3s;z-index:1}' +
    '.wb-voice-btn:hover{transform:scale(1.1);box-shadow:0 6px 24px rgba(16,185,129,.5)}' +
    '.wb-voice-btn.wb-voice-connecting{background:linear-gradient(135deg,#f59e0b,#d97706);animation:wb-pulse-voice 1s ease-in-out infinite}' +
    '.wb-voice-btn.wb-voice-active{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 16px rgba(239,68,68,.4)}' +
    '.wb-voice-btn.wb-voice-active:hover{box-shadow:0 6px 24px rgba(239,68,68,.5)}' +
    '@keyframes wb-pulse-voice{0%,100%{opacity:1}50%{opacity:.7}}' +
    '.wb-voice-status{position:absolute;top:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid var(--wb-bg,#0d1117)}' +
    '.wb-voice-connecting .wb-voice-status{background:#f59e0b}' +
    '.wb-voice-active .wb-voice-status{background:#ef4444;animation:wb-pulse-voice 1s ease-in-out infinite}' +
    '.wb-voice-tooltip{position:absolute;right:52px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.85);color:#fff;font-size:11px;font-weight:500;padding:5px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}' +
    '.wb-voice-btn:hover .wb-voice-tooltip{opacity:1}' +
    '.wb-sales-agent.is-open .wb-voice-btn{bottom:auto;top:-54px}' +

    '@media(max-width:480px){.wb-sa-panel{width:calc(100vw - 32px);right:-8px;bottom:64px;max-height:70vh}.wb-sa-toggle{width:50px;height:50px}.wb-sales-agent{bottom:16px;right:16px}.wb-voice-btn{width:40px;height:40px}}' +
    '@keyframes wb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';

  document.head.appendChild(style);

  // ─── Render Functions ─────────────────────────────────────────────
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
      if (linkData.external) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
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
    var delay = Math.min(30 * flow.message.length, 800);
    delay = Math.max(delay, 300);

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
        name: name,
        email: email,
        phone: phone,
        need: need,
        product: product,
        timestamp: new Date().toISOString(),
        page: window.location.href
      };

      state.capturedLeads.push(lead);

      // Send to server (KV-backed) — localStorage as fallback
      try {
        fetch('/_wb-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead)
        }).then(function(r) {
          if (r.ok) console.log('[WorkBench Agent] Lead saved to server');
        }).catch(function() {});
      } catch(e) {}
      try {
        var stored = JSON.parse(localStorage.getItem('wb_leads') || '[]');
        stored.push(lead);
        localStorage.setItem('wb_leads', JSON.stringify(stored));
      } catch(e) {}

      console.log('[WorkBench Agent] Lead captured:', lead);

      form.remove();
      addMessage('Name: ' + name + '\\nEmail: ' + email + (phone ? '\\nPhone: ' + phone : '') + (need ? '\\nRe: ' + need : ''), 'user');
      renderFlow('capture_success');
    });
  }

  // ─── Toggle ───────────────────────────────────────────────────────
  function toggleChat() {
    state.isOpen = !state.isOpen;
    if (state.isOpen) {
      container.classList.add('is-open');
      toggleBtn.setAttribute('aria-label', 'Close chat');
      var badge = toggleBtn.querySelector('.wb-sa-badge');
      if (badge) badge.remove();
      if (state.messages.length === 0) {
        renderFlow('greeting');
      }
    } else {
      container.classList.remove('is-open');
      toggleBtn.setAttribute('aria-label', 'Chat with WorkBench');
    }
  }

  toggleBtn.addEventListener('click', toggleChat);
  panel.querySelector('.wb-sa-minimize').addEventListener('click', toggleChat);

  // ─── Badge after 3s ───────────────────────────────────────────────
  setTimeout(function() {
    if (!state.isOpen) {
      var badge = document.createElement('div');
      badge.className = 'wb-sa-badge';
      toggleBtn.appendChild(badge);
    }
  }, 3000);

  // ─── Auto-open after 8s (once per 24h) ────────────────────────────
  setTimeout(function() {
    if (state.isOpen) return;
    try {
      var last = localStorage.getItem('wb_sa_dismissed');
      if (last && (Date.now() - parseInt(last)) / 3600000 < 24) return;
    } catch(e) {}
    toggleChat();
    try { localStorage.setItem('wb_sa_dismissed', Date.now().toString()); } catch(e) {}
  }, 8000);

  // ─── Hide existing chat widgets to avoid conflict ─────────────────
  try {
    var hideCSS = document.createElement('style');
    hideCSS.textContent = '#crisp-chatbox, .intercom-lightweight-app, .intercom-app, [data-testid="chat-widget"], iframe[title*="chat" i], iframe[title*="crisp" i], iframe[title*="intercom" i] { display: none !important; }';
    document.head.appendChild(hideCSS);
  } catch(e) {}

  // ─── Fix "Go to Admin" button on dashboard ─────────────────────────
  try {
    function wbFixAdminLink() {
      if (window.location.pathname !== '/dashboard') return;
      var els = document.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        if (els[i].childElementCount === 0 && els[i].textContent.trim() === 'Go to Admin') {
          // Found the text element — walk up to the card (look for a styled container)
          var node = els[i];
          for (var p = 0; p < 8; p++) {
            node = node.parentElement;
            if (!node || node === document.body) break;
            var cs = window.getComputedStyle(node);
            if (cs.borderRadius && cs.borderRadius !== '0px') break;
          }
          if (node && node !== document.body && !node._wbFixed) {
            node._wbFixed = true;
            node.style.cursor = 'pointer';
            node.addEventListener('click', function() { window.location.href = '/admin'; });
          }
          return;
        }
      }
    }
    setTimeout(wbFixAdminLink, 2000);
    setTimeout(wbFixAdminLink, 5000);
    setTimeout(wbFixAdminLink, 8000);
  } catch(e) {}

  // ─── Inject GTM Dashboard into admin sidebar ─────────────────────
  try {
    function wbInjectGTMLink() {
      if (window.location.pathname !== '/admin') return;
      if (document.getElementById('wb-gtm-link')) return;
      // Find the sidebar nav — look for "Audit Log" or similar text to locate the nav
      var navItems = document.querySelectorAll('a[href], [role="menuitem"], nav a, aside a');
      var sidebar = null;
      for (var i = 0; i < navItems.length; i++) {
        var text = navItems[i].textContent.trim().toLowerCase();
        if (text === 'audit log' || text === 'analytics' || text === 'leaderboard' || text === 'dashboard') {
          sidebar = navItems[i].parentElement;
          break;
        }
      }
      if (!sidebar) {
        // Try finding sidebar by structure — look for vertical nav
        var asides = document.querySelectorAll('aside, nav, [class*="sidebar"], [class*="Sidebar"], [class*="nav"]');
        for (var j = 0; j < asides.length; j++) {
          if (asides[j].querySelectorAll('a').length >= 3) {
            sidebar = asides[j];
            break;
          }
        }
      }
      if (!sidebar) return;

      var link = document.createElement('a');
      link.id = 'wb-gtm-link';
      link.href = '/_wb-admin?key=novai2025wb';
      link.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;color:#e6edf3;text-decoration:none;font-size:14px;font-weight:500;border-radius:8px;margin:4px 8px;background:linear-gradient(135deg,rgba(0,119,255,0.15),rgba(0,187,255,0.1));border:1px solid rgba(0,119,255,0.2);transition:all 0.15s;';
      link.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0077ff" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> GTM Dashboard';
      link.onmouseover = function() { this.style.background = 'linear-gradient(135deg,rgba(0,119,255,0.25),rgba(0,187,255,0.15))'; };
      link.onmouseout = function() { this.style.background = 'linear-gradient(135deg,rgba(0,119,255,0.15),rgba(0,187,255,0.1))'; };
      sidebar.appendChild(link);
    }
    setTimeout(wbInjectGTMLink, 2000);
    setTimeout(wbInjectGTMLink, 5000);
  } catch(e) {}

  // ─── Voice Call Button ──────────────────────────────────────────
  // Mobile: dials +1 (943) 223-9707 directly
  // Desktop: browser-based Vapi call via WebRTC
  (function initVoiceButton() {
    var PHONE_NUMBER = '+19432239707';
    var VAPI_PUBLIC_KEY = '6c4b7bf5-65ba-4855-aebb-1778f7c8994c';
    var VAPI_ASSISTANT_ID = '66890f6b-a091-4922-83ed-46328ecfecd1';
    var vapiInstance = null;
    var callActive = false;
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    // Phone button
    var phoneBtn = document.createElement('button');
    phoneBtn.className = 'wb-voice-btn';
    phoneBtn.setAttribute('aria-label', 'Call WorkBench');
    phoneBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>';

    // Status indicator
    var statusDot = document.createElement('span');
    statusDot.className = 'wb-voice-status';
    phoneBtn.appendChild(statusDot);

    // Tooltip
    var tooltip = document.createElement('span');
    tooltip.className = 'wb-voice-tooltip';
    tooltip.textContent = isMobile ? 'Call us' : 'Call AI agent';
    phoneBtn.appendChild(tooltip);

    function loadVapiSDK(cb) {
      if (window.Vapi) return cb();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js';
      s.onload = function() { setTimeout(cb, 100); };
      s.onerror = function() {
        console.error('[WorkBench Voice] SDK failed, falling back to tel:');
        phoneBtn.classList.remove('wb-voice-connecting');
        window.location.href = 'tel:' + PHONE_NUMBER;
      };
      document.head.appendChild(s);
    }

    function startCall() {
      // Mobile: always dial directly
      if (isMobile) {
        window.location.href = 'tel:' + PHONE_NUMBER;
        return;
      }

      // Desktop: Vapi browser call
      if (callActive) {
        if (vapiInstance) vapiInstance.stop();
        return;
      }

      phoneBtn.classList.add('wb-voice-connecting');
      tooltip.textContent = 'Connecting...';

      loadVapiSDK(function() {
        try {
          vapiInstance = new window.Vapi(VAPI_PUBLIC_KEY);

          vapiInstance.on('call-start', function() {
            callActive = true;
            phoneBtn.classList.remove('wb-voice-connecting');
            phoneBtn.classList.add('wb-voice-active');
            tooltip.textContent = 'End call';
          });

          vapiInstance.on('call-end', function() {
            callActive = false;
            phoneBtn.classList.remove('wb-voice-active', 'wb-voice-connecting');
            tooltip.textContent = 'Call AI agent';
            vapiInstance = null;
          });

          vapiInstance.on('error', function(e) {
            console.error('[WorkBench Voice] Error:', e);
            callActive = false;
            phoneBtn.classList.remove('wb-voice-active', 'wb-voice-connecting');
            tooltip.textContent = 'Call AI agent';
            vapiInstance = null;
            // Fallback to tel: on error
            window.location.href = 'tel:' + PHONE_NUMBER;
          });

          vapiInstance.start(VAPI_ASSISTANT_ID);
        } catch(e) {
          console.error('[WorkBench Voice] Init error:', e);
          phoneBtn.classList.remove('wb-voice-connecting');
          tooltip.textContent = 'Call AI agent';
          window.location.href = 'tel:' + PHONE_NUMBER;
        }
      });
    }

    phoneBtn.addEventListener('click', startCall);
    container.appendChild(phoneBtn);
  })();

  // ─── Mount ────────────────────────────────────────────────────────
  document.body.appendChild(container);
})();
`;

import { handleVoiceWebhook, handleCallLog, handleAnalytics } from './voice-agent.js';
import { handleAdminDashboard, verifyAdmin } from './admin-dashboard.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWorkbench = url.hostname === "workbench.novaisystems.online";

    // ─── Admin Dashboard ───
    if (url.pathname === "/_wb-admin") {
      return handleAdminDashboard(request);
    }

    // ─── Voice Agent: Vapi webhooks + analytics ───
    if (url.pathname.startsWith("/_wb-voice/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400"
          }
        });
      }
      if (url.pathname === "/_wb-voice/webhook" && request.method === "POST") {
        return handleVoiceWebhook(request, env);
      }
      if (url.pathname === "/_wb-voice/calls" && request.method === "GET") {
        return handleCallLog(request, env);
      }
      if (url.pathname === "/_wb-voice/analytics" && request.method === "GET") {
        return handleAnalytics(request, env);
      }
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ─── CORS preflight for lead API ───
    if (request.method === "OPTIONS" && url.pathname.startsWith("/_wb-leads")) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // ─── Lead Capture API: POST /_wb-leads ───
    if (url.pathname === "/_wb-leads" && request.method === "POST") {
      try {
        const lead = await request.json();
        if (!lead.email) {
          return new Response(JSON.stringify({ error: "email required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        const id = "lead_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        lead.id = id;
        lead.created = new Date().toISOString();
        lead.source_host = url.hostname;

        if (env.WB_LEADS) {
          // Store individual lead
          await env.WB_LEADS.put(id, JSON.stringify(lead));
          // Update index (list of all lead IDs)
          const indexRaw = await env.WB_LEADS.get("_index");
          const index = indexRaw ? JSON.parse(indexRaw) : [];
          index.unshift(id);
          await env.WB_LEADS.put("_index", JSON.stringify(index));
        }

        return new Response(JSON.stringify({ ok: true, id }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // ─── Lead Viewer API: GET /_wb-leads?key=ADMIN_KEY ───
    if (url.pathname === "/_wb-leads" && request.method === "GET") {
      if (!verifyAdmin(request)) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      try {
        if (!env.WB_LEADS) {
          return new Response(JSON.stringify({ leads: [], note: "KV not configured" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        const indexRaw = await env.WB_LEADS.get("_index");
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const leads = [];
        for (let i = 0; i < Math.min(index.length, limit); i++) {
          const raw = await env.WB_LEADS.get(index[i]);
          if (raw) leads.push(JSON.parse(raw));
        }
        return new Response(JSON.stringify({ total: index.length, leads }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

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
