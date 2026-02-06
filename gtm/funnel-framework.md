# WorkBench GTM Funnel Framework — LA Market

## Master Funnel Architecture

```
                    ┌─────────────────────────┐
                    │      AWARENESS          │
                    │   (All LA channels)      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │      ENGAGEMENT         │
                    │   (Response/Click)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │       SIGNUP            │
                    │  (Account created)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │     VERIFICATION        │
                    │ (Profile + ID verified)  │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │     ACTIVE USER         │
                    │  (First job/booking)     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │      RETAINED           │
                    │   (Repeat activity)      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │      ADVOCATE           │
                    │  (Referrals/reviews)     │
                    └─────────────────────────┘
```

## Channel → Funnel Mapping

### Provider Acquisition Channels

| Channel | Daily Volume | Awareness → Signup | Signup → Active | Cost/Acquisition |
|---------|-------------|-------------------|-----------------|-----------------|
| Outbound calls | 80-120 calls | 8-15% | 70% | ~$15-25 |
| Email sequences | 200-400 sends | 3-5% | 60% | ~$5-10 |
| Instagram DMs | 30-50 DMs | 10-15% | 65% | ~$8-15 |
| LinkedIn DMs | 20-30 DMs | 12-18% | 75% | ~$10-20 |
| Nextdoor posts | 10-20 DMs | 15-25% | 70% | ~$5-10 |
| Facebook groups | 15-25 DMs | 8-12% | 60% | ~$8-15 |
| Google/Yelp scrape + contact | 50-100/day | 5-8% | 65% | ~$12-20 |
| Referral from existing providers | Organic | 30-40% | 85% | ~$0-5 |
| Web agent (workbench.novaisystems.online) | Organic | 15-20% | 60% | ~$0 |

### Customer Acquisition Channels

| Channel | Daily Volume | Awareness → Signup | Signup → Active | Cost/Acquisition |
|---------|-------------|-------------------|-----------------|-----------------|
| Outbound calls | 40-60 calls | 10-15% | 50% | ~$10-20 |
| Email sequences | 300-500 sends | 5-8% | 45% | ~$3-8 |
| Social DMs | 50-80 DMs | 8-12% | 40% | ~$5-12 |
| Community posts/replies | 20-40/day | 12-18% | 55% | ~$3-8 |
| SEO (organic) | Growing | 3-5% | 50% | ~$0 |
| Web agent | Organic | 10-15% | 45% | ~$0 |
| Referral from providers | Organic | 25-35% | 70% | ~$0-3 |
| Nextdoor recommendations | 15-25/day | 20-30% | 60% | ~$2-5 |

---

## Lead Qualification Framework

### Provider Lead Scoring

| Signal | Points | Weight |
|--------|--------|--------|
| Has existing business (Yelp/Google listing) | +20 | High |
| Licensed/certified | +15 | High |
| Located in LA metro | +10 | Required |
| Active on social media | +10 | Medium |
| Responded to outreach | +15 | High |
| Asked pricing questions | +10 | Medium |
| Has reviews/ratings elsewhere | +10 | Medium |
| Expressed interest in signup | +20 | High |
| In high-demand category | +10 | Medium |
| In underserved area | +10 | Medium |

**Scoring tiers:**
- 80+ = Hot lead — priority onboarding
- 50-79 = Warm lead — nurture + follow-up
- 30-49 = Cool lead — email drip only
- <30 = Not qualified — deprioritize

### Customer Lead Scoring

| Signal | Points | Weight |
|--------|--------|--------|
| Located in LA metro | +10 | Required |
| Expressed specific service need | +20 | High |
| Asked about providers/pricing | +15 | High |
| Clicked signup link | +15 | High |
| Provided contact info | +20 | High |
| Came from referral | +15 | High |
| Engaged with web agent | +10 | Medium |
| In area with active providers | +10 | Medium |

---

## Verification Pipeline (REAL ACCURATE VERIFIED USERS)

### Provider Verification Steps
```
1. Signup → Account created (automated)
2. Profile completion → Services, rates, area (self-serve)
3. Identity verification:
   - Government ID check
   - Business license verification (where applicable)
   - Insurance verification (where applicable)
4. Background check (for applicable categories)
5. Reference check (2 professional references)
6. Admin review → Approve / Request more info / Reject
7. Go live → Profile visible to customers
```

### Customer Verification Steps
```
1. Signup → Account created (automated)
2. Email verification (automated)
3. Phone verification (automated SMS)
4. First booking → Address/payment verified
5. Active user
```

### Verification Quality Gates
- **No fake accounts**: Phone + email verification required
- **No duplicate providers**: Cross-reference by name, phone, address
- **No spam signups**: Rate limiting + CAPTCHA on signup
- **Admin final review**: Every provider manually reviewed before going live
- **Ongoing quality**: Post-job ratings, complaint tracking, periodic re-verification

---

## GTM Week-by-Week Execution Plan

### Week 1: Infrastructure
- [ ] Set up email sending infrastructure (domain auth, warm-up)
- [ ] Create CRM/tracking spreadsheet or tool
- [ ] Build target lists: top 500 LA service providers by category
- [ ] Set up phone system for inbound/outbound
- [ ] Prepare all scripts (call, email, DM) — DONE (this repo)

### Week 2: Provider Supply Blitz
- [ ] Start outbound calls — 80/day, focus on home services
- [ ] Launch Email Sequence 1 to first 200 providers
- [ ] Start Instagram/LinkedIn DMs — 50/day
- [ ] Post in 10 LA Facebook groups about WorkBench
- [ ] Target: 30 provider signups

### Week 3: Customer Demand Generation
- [ ] Start customer outreach — calls + emails
- [ ] Nextdoor campaign — respond to every service request
- [ ] Facebook/Instagram customer ads (if budget allows)
- [ ] Web agent live and capturing leads — DONE
- [ ] Target: 50 customer signups

### Week 4: Activation Push
- [ ] Follow up with all incomplete profiles
- [ ] First bookings tracked and supported
- [ ] Case studies collected from early users
- [ ] Admin reviewing all provider verifications
- [ ] Target: 15 completed jobs

### Month 2: Scale
- [ ] Double outbound volume
- [ ] Launch referral program
- [ ] SEO content for LA service searches
- [ ] Expand to all LA neighborhoods
- [ ] Target: 100 providers, 200 customers, 50 jobs

### Month 3: Optimize
- [ ] NBA pricing engine live
- [ ] Self-correction loops from job data
- [ ] RAG optimization on agent conversations
- [ ] Referral flywheel active
- [ ] Target: 250 providers, 500 customers, 150 jobs

---

## KPI Dashboard

### Daily Metrics
- Outbound calls made / connects / conversions
- Emails sent / opens / clicks / replies
- DMs sent / responses / conversions
- New signups (provider + customer)
- Profile completions
- Leads captured (web agent + all channels)

### Weekly Metrics
- Total active providers by category
- Total active customers by area
- Jobs posted / matched / completed
- Revenue (GMV + platform fee)
- Provider verification backlog
- Funnel conversion rates by channel

### Monthly Metrics
- Total verified users (provider + customer)
- Monthly GMV
- Platform revenue
- Customer acquisition cost (CAC)
- Provider acquisition cost
- Retention rate (30-day)
- NPS / satisfaction scores
- Market coverage (% of LA zip codes with active providers)

---

## Data Pool Growth Targets

| Milestone | Providers | Customers | Monthly Jobs | Timeline |
|-----------|-----------|-----------|-------------|----------|
| Launch | 7 | ~20 | 5 | Current |
| Traction | 50 | 150 | 30 | Month 1 |
| Growth | 150 | 500 | 100 | Month 3 |
| Scale | 500 | 2000 | 500 | Month 6 |
| Market fit | 1500 | 8000 | 2000 | Month 12 |

All users: **REAL. ACCURATE. VERIFIED.** No vanity metrics.
