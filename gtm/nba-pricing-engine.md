# NBA (Next Best Action) Pricing Engine — WorkBench

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MCP CONTEXT LAYER                      │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Case    │  │ Market   │  │ Provider  │  │ Job     │ │
│  │ Studies │  │ Comps    │  │ History   │  │ Context │ │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  └────┬────┘ │
│       └────────────┼──────────────┼──────────────┘      │
│                    ▼                                      │
│            ┌───────────────┐                              │
│            │  NBA ENGINE   │                              │
│            │               │                              │
│            │ Analyze →     │                              │
│            │ Recommend →   │                              │
│            │ Present       │                              │
│            └───────┬───────┘                              │
└────────────────────┼─────────────────────────────────────┘
                     ▼
         ┌───────────────────────┐
         │   HUMAN DECISION      │
         │                       │
         │ Customer sees range   │
         │ Provider sees range   │
         │ Both negotiate/agree  │
         └───────────┬───────────┘
                     ▼
         ┌───────────────────────┐
         │   ADMIN FINALIZE      │
         │                       │
         │ Review final price    │
         │ Approve billing       │
         │ Trigger payment       │
         └───────────────────────┘
```

## NBA Engine Logic

### Input: Job Request
```json
{
  "category": "plumbing",
  "subcategory": "repair",
  "description": "Kitchen faucet leaking, needs replacement",
  "urgency": "standard",
  "location_zip": "90028",
  "customer_id": "cust_123",
  "preferred_schedule": "next_3_days"
}
```

### Processing Steps

#### Step 1: Category Base Rate
```
Lookup: market_rates[category][subcategory]
→ plumbing.repair = { low: $120, mid: $200, high: $350 }
```

#### Step 2: Location Multiplier
```
Lookup: zip_pricing_tier[90028]
→ Hollywood = "standard" tier → multiplier: 1.0x
→ Adjusted: { low: $120, mid: $200, high: $350 }
```

#### Step 3: Urgency Modifier
```
If urgency === "same_day": multiply by 1.5-2.0x
If urgency === "standard": multiply by 1.0x
If urgency === "flexible": multiply by 0.9x (discount)
→ standard → 1.0x
→ Adjusted: { low: $120, mid: $200, high: $350 }
```

#### Step 4: Complexity Assessment
```
NLP on description → "faucet replacement" = standard complexity
Simple repair: 0.8x
Standard: 1.0x
Complex: 1.3x
Major: 1.5-2.0x
→ Standard → 1.0x
→ Adjusted: { low: $120, mid: $200, high: $350 }
```

#### Step 5: Historical Match
```
Query: completed_jobs WHERE category="plumbing"
  AND subcategory="repair"
  AND zip LIKE "900%"
  AND completed_at > 90_days_ago

Results:
  - Job A: faucet repair, 90028, $180, rated 5/5
  - Job B: faucet install, 90036, $220, rated 4/5
  - Job C: pipe repair, 90028, $275, rated 5/5

Historical median: $220
Historical range: $180-$275
```

#### Step 6: Provider-Specific Data
```
If matched to specific provider:
  - Provider avg rate for this category: $195
  - Provider rating: 4.8/5
  - Provider completion rate: 95%
  - Premium for top-rated: +10%
  → Provider-adjusted: $195-$215
```

### Output: NBA Recommendation
```json
{
  "job_id": "job_456",
  "recommendation": {
    "suggested_range": {
      "low": "$150",
      "mid": "$200",
      "high": "$275"
    },
    "confidence": "high",
    "reasoning": [
      "Standard faucet replacement in Hollywood (90028)",
      "Based on 3 comparable jobs in last 90 days",
      "Market rate for plumbing repairs: $120-$350",
      "Historical median in this area: $220"
    ],
    "comparable_jobs": [
      { "description": "Faucet repair", "price": "$180", "rating": "5/5" },
      { "description": "Faucet install", "price": "$220", "rating": "4/5" }
    ],
    "market_context": {
      "demand_level": "medium",
      "available_providers": 4,
      "avg_response_time": "2 hours"
    }
  },
  "status": "awaiting_human_decision"
}
```

---

## Human Decision Flow

### Customer View
```
Your job: Kitchen faucet replacement
Estimated price range: $150 - $275

Based on:
✓ 3 similar jobs in your area
✓ Current market rates
✓ Standard complexity

[Browse providers who can do this →]
[Set your budget: $___]
```

### Provider View
```
Job request: Kitchen faucet replacement — Hollywood, 90028
Suggested rate: $150 - $275

Market intel:
✓ Similar jobs averaged $200 in this area
✓ Customer urgency: standard (3-day window)
✓ 3 other providers can see this job

[Submit your rate: $___]
[Accept at suggested rate →]
```

### Negotiation
```
Customer budget: $200
Provider rate: $225

NBA suggestion: Meet at $210 (within range, fair for both)

[Customer: Accept $210] [Counter-offer]
[Provider: Accept $210] [Counter-offer]
```

### Admin Finalization
```
Job #456: Kitchen faucet replacement
Customer: [Name] — Hollywood, 90028
Provider: [Name] — Licensed Plumber, 4.8★

Agreed price: $210
NBA suggested range: $150-$275 ✓ Within range
Market comparison: $220 median ✓ Competitive

Platform fee: $[X]
Provider payout: $[X]

[Approve & Send Invoice]
[Adjust Amount]
[Flag for Review]
```

---

## MCP Server Design

### Tools the NBA MCP exposes:

```typescript
// Tool 1: Get pricing recommendation
get_pricing_recommendation({
  category: string,
  subcategory: string,
  description: string,
  urgency: "same_day" | "standard" | "flexible",
  location_zip: string
}) → PricingRecommendation

// Tool 2: Get comparable jobs
get_comparable_jobs({
  category: string,
  location_zip: string,
  days_back: number,
  limit: number
}) → ComparableJob[]

// Tool 3: Get provider rates
get_provider_rates({
  provider_id: string,
  category: string
}) → ProviderRateHistory

// Tool 4: Get market context
get_market_context({
  category: string,
  location_zip: string
}) → MarketContext

// Tool 5: Submit human decision
submit_price_decision({
  job_id: string,
  decided_by: "customer" | "provider" | "admin",
  amount: number,
  notes?: string
}) → Decision

// Tool 6: Admin finalize
admin_finalize_billing({
  job_id: string,
  final_amount: number,
  platform_fee: number,
  provider_payout: number,
  admin_notes?: string
}) → BillingRecord
```

### Data Resources the MCP exposes:

```typescript
// Resource 1: Market rates
resource://market-rates/{category}/{subcategory}

// Resource 2: Zip code pricing tiers
resource://pricing-tiers/{zip_code}

// Resource 3: Seasonal demand
resource://demand/{category}/{month}

// Resource 4: Case studies
resource://case-studies/{category}

// Resource 5: Provider leaderboard
resource://providers/top/{category}/{area}
```

---

## Self-Correction Loop

```
Job completed
     │
     ▼
Collect outcome data:
  - Final price paid
  - Customer satisfaction (1-5)
  - Provider satisfaction (1-5)
  - Job completion time
  - Any disputes?
     │
     ▼
Compare to NBA prediction:
  - Was suggested range accurate?
  - Did final price fall within range?
  - Was customer happy with pricing?
  - Was provider happy with payout?
     │
     ▼
Adjust model:
  - If price consistently above range → adjust base rates up
  - If price consistently below → adjust down
  - If low satisfaction at high price → flag category
  - If disputes frequent → tighten verification
     │
     ▼
Update RAG knowledge base:
  - Add completed job to case studies
  - Update market rate tables
  - Refine zip code multipliers
  - Improve complexity assessment
```

---

## Implementation Phases

### Phase 1: Static Intelligence (NOW — buildable from this repo)
- Market rate tables (done — in case-studies.md)
- Zip code pricing tiers (done)
- Seasonal demand patterns (done)
- Case study templates (done)
- All fed into sales agent conversations

### Phase 2: Dynamic Pricing API (needs works-api)
- Endpoint: POST /api/nba/pricing
- Pulls from completed job database
- Returns structured recommendation
- Admin dashboard integration

### Phase 3: MCP Server (new worker or service)
- Full MCP protocol implementation
- Tools + Resources as defined above
- Connected to works-api for live data
- Self-correction loop active

### Phase 4: AI-Powered (future)
- NLP job description analysis
- Predictive demand modeling
- Provider-customer matching optimization
- Automated follow-up sequences based on NBA
