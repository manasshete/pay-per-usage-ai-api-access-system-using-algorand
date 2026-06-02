# Sentinel AI Studio — Revenue Model (2026)

**Document version:** 1.0  
**Date:** 1 June 2026  
**Scope:** AI Studio (Agentic Pipeline, Workflow Studio, Prompt Generator, Blog Agent, ClipCraft)  
**Payment rail:** Algorand (ALGO) subscriptions + optional pay-per-run overage  
**Cost basis:** Your actual Google Cloud / Gemini billing (screenshots May 27 – June 2, 2026)

---

## 1. Executive summary

Your current Studio subscription prices (**Creator 5 ALGO · Pro 15 ALGO · Enterprise 40 ALGO per month**) are **far below** real Gemini + infrastructure costs. In one test week you incurred **₹367 gross** (~**$4.42 USD**) on Google alone, while Creator tier revenue at today’s ALGO price is only **~₹54/month** (~**$0.65**).

This document proposes a **cost-plus, credit-weighted** model that:

1. Covers **Google Gemini pipeline COGS** (text, image, TTS, Veo video)
2. Covers **deployment** (Render, MongoDB, domain, storage, monitoring)
3. Maintains **≥ 45% gross margin** after variable costs
4. Prices in **ALGO** with **INR and USD** reference columns for finance reporting
5. Uses **weighted “Studio Credits”** so heavy multimodal runs consume more quota than text-only runs

**Recommended headline prices (TestNet → MainNet when live):**

| Tier | New price (ALGO/mo) | ≈ INR/mo | ≈ USD/mo | Included Studio Credits |
|------|---------------------|----------|----------|-------------------------|
| Free | 0 | ₹0 | $0 | 15 credits |
| Creator | **45** | ₹486 | $5.81 | 120 credits |
| Pro | **120** | ₹1,301 | $15.48 | 400 credits |
| Enterprise | **350** | ₹3,794 | $45.15 | 1,500 credits + SLA |

> **Why the increase?** One full Agentic run (script → 3 images → Veo video → TTS) costs Google **₹60–₹120** ($0.70–$1.45) at paid-tier list prices. Five ALGO/month cannot fund even **one** such run per subscriber.

---

## 2. Your actual Gemini usage (from billing screenshots)

### 2.1 Google Cloud billing (INR)

| Period | Gross cost | Google credits/savings | **Net paid** |
|--------|-----------|------------------------|--------------|
| May 27 – Jun 2, 2026 (7 days) | ₹367 | −₹165 | **₹202** |
| Jun 1 – 2, 2026 (2 days) | ₹189 | −₹165 | **₹24.77** |

**Peak day:** May 29 ≈ **₹165 gross** (majority of weekly spend).

> ⚠️ **Credits expire.** Model pricing on **gross** cost, not net-after-credits. When the ₹165/month free tier credits end, your bill approaches **gross** amounts.

### 2.2 API usage pattern (same week)

| Metric | Observed peak |
|--------|---------------|
| Total API requests | ~125 (spike at month-end) |
| Success rate during spike | ~50% (429 TooManyRequests, 503 ServiceUnavailable) |
| Gemini 2.5 Flash input tokens | ~18,000 |
| Gemini 2.5 Flash output tokens | ~65,000–70,000 |
| Gemini 2.5 Flash TTS requests | ~40/day peak |
| Nano Banana (2.5 Flash Image) requests | ~39/day peak |
| Agentic Pipeline runs (Studio UI) | ~13 of 200 quota (Creator plan) |

### 2.3 Derived unit economics from *your* data

| Calculation | Value |
|-------------|-------|
| Gross spend ÷ peak request count | ₹367 ÷ 125 ≈ **₹2.94/request** (blended, includes cheap + expensive calls) |
| Gross spend ÷ ~13 heavy Studio runs | ₹367 ÷ 13 ≈ **₹28/run** (if most spend = Agentic/Workflow) |
| Peak-day gross ÷ 13 runs | ₹165 ÷ 13 ≈ **₹12.7/run** (conservative lower bound) |

**Planning COGS per run type (use gross, add 20% buffer for retries/429s):**

| Run type | Google models used | Est. COGS (INR) | Est. COGS (USD) |
|----------|-------------------|-----------------|-----------------|
| **Lite** — text / router / eval / memory | Gemini 2.5 Flash | ₹2 – ₹4 | $0.02 – $0.05 |
| **Standard** — text + blog / workflow AI node | Flash + Groq (creator key) | ₹4 – ₹8 | $0.05 – $0.10 |
| **Creative** — prompt + 1–3 images | Flash + Flash Image | ₹10 – ₹25 | $0.12 – $0.30 |
| **Agentic medium** — text + 3 images (no video) | Flash + Image ×3 | ₹25 – ₹45 | $0.30 – $0.54 |
| **Agentic full** — text + images + Veo + TTS | Flash + Image + Veo Fast + TTS | **₹60 – ₹120** | **$0.70 – $1.45** |

*Veo 3.1 Fast with audio: **$0.10–$0.12** per 720p–1080p clip (Google list price). Three Imagen/Flash images ≈ $0.06–$0.12. Text/TTS/router ≈ $0.05–$0.15.*

---

## 3. Google Gemini list prices (paid tier, June 2026)

Source: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

| Model / feature | Unit | USD (list) |
|-----------------|------|------------|
| Gemini 2.5 Flash — input | per 1M tokens | $0.30 |
| Gemini 2.5 Flash — output | per 1M tokens | $2.50 |
| Gemini 2.5 Flash Image — output | per 1M image tokens | $30 (~$0.03–$0.04/image) |
| Gemini 2.5 Flash TTS | per 1M tokens | (see TTS preview tier; budget **$0.05–$0.15/run**) |
| Veo 3.1 Fast (720p, with audio) | per second / clip | **$0.10** (8s ≈ $0.10–$0.80 depending on length) |
| Veo 3.1 Standard | per clip | $0.40+ |
| Embeddings (memory) | per 1M tokens | ~$0.01 |

**Rate-limit note (your screenshot):** Free/low-tier quotas (e.g. TTS **10 RPM**, Image **500 RPM** but **2K RPD**) cause **429 errors** → retries → **higher effective COGS**. Budget **+15–20%** on multimodal runs.

---

## 4. Fixed monthly costs (deployment & ops)

Assumes: Render monorepo (`sentinal-api`), MongoDB Atlas, domain, optional GCS, public Algorand nodes.

| Item | Plan | USD/mo | INR/mo (@ ₹84.5) |
|------|------|--------|------------------|
| Render web service | Standard (1 vCPU, 2 GB) — required for Agentic SSE + ffmpeg mux | $25 | ₹2,113 |
| Render workspace | Hobby / Pro (team) | $0 – $25 | ₹0 – ₹2,113 |
| MongoDB Atlas | M2 Shared (2 GB) | $9 | ₹760 |
| Domain (sentinalai.com / .dev) | amortized annual | $2 | ₹169 |
| Google Cloud Storage (assets) | ~50 GB + egress | $5 | ₹423 |
| Firebase Auth | Spark free tier | $0 | ₹0 |
| Monitoring / logs (optional) | Better Stack / free tier | $0 – $15 | ₹0 – ₹1,268 |
| SSL / CDN | Included (Render / Cloudflare free) | $0 | ₹0 |
| Contingency (10%) | — | $4 | ₹338 |
| **Total fixed (lean production)** | | **~$45 – $70** | **~₹3,800 – ₹5,900** |

**Break-even fixed cost only:** at **45 ALGO** (~₹486) you need **~8–12 paying Creator subscribers** just to cover hosting (no AI usage).

---

## 5. Exchange rate reference (1 June 2026)

Use these for ALGO ↔ fiat reporting. **Update weekly** in production billing.

| Asset | USD | INR (₹) |
|-------|-----|---------|
| **1 ALGO** | $0.129 | ₹10.91 |
| **1 USD** | $1.00 | ₹84.50 |
| **1 INR** | $0.0118 | ₹1.00 |

**Quick conversion formulas:**

```
INR = ALGO × 10.91
USD = ALGO × 0.129
ALGO = INR ÷ 10.91
ALGO = USD ÷ 0.129
```

### Current vs proposed plan prices

| Tier | Current ALGO | Current ≈ INR | Current ≈ USD | **Proposed ALGO** | **Proposed ≈ INR** | **Proposed ≈ USD** |
|------|-------------|---------------|---------------|-------------------|--------------------|--------------------|
| Creator | 5 | ₹55 | $0.65 | **45** | **₹491** | **$5.81** |
| Pro | 15 | ₹164 | $1.94 | **120** | **₹1,309** | **$15.48** |
| Enterprise | 40 | ₹436 | $5.16 | **350** | **₹3,819** | **$45.15** |

---

## 6. Studio Credits system (recommended)

Replace flat “200 AI runs” with **weighted credits** so text stays affordable and video stays profitable.

### 6.1 Credit weights per action

| Action | Studio Credits | Typical COGS (₹) | Notes |
|--------|---------------|------------------|-------|
| Prompt Generator (single) | 1 | ₹2 | Gemini Flash |
| Blog Agent (generate draft) | 2 | ₹4 | Gemini + Groq |
| Workflow — AI node only | 2 | ₹4 | Groq / Flash |
| Workflow — Creative (prompt + image) | 6 | ₹15 | Image model |
| Agentic — text only | 2 | ₹4 | Router + eval |
| Agentic — text + images | 8 | ₹30 | 1–3 images |
| Agentic — text + images + video | **25** | ₹80 | Veo |
| Agentic — full (video + audio) | **35** | ₹100 | Veo + TTS + mux |
| ClipCraft pack (1.5 credits) | 5 | ₹12 | Short-form pipeline |

### 6.2 Monthly credit pools (aligned to COGS + margin)

| Tier | Monthly credits | Max full Agentic runs | Max text-only runs |
|------|-----------------|----------------------|-------------------|
| Free | 15 | 0 (video blocked) | ~7 |
| Creator | 120 | ~3 full / ~15 image / ~60 text | |
| Pro | 400 | ~11 full / ~50 image / ~200 text | |
| Enterprise | 1,500 | Custom + dedicated quota | |

**Creator tier sanity check:**  
120 credits ≈ 3× full Agentic (3×35=105) + buffer  
COGS ≈ 3×₹100 = **₹300**; subscription **₹491** → **~39% margin** before fixed costs.  
With 10 Creators, AI variable margin covers ~₹1,900 of ₹4,500 fixed — need **~24 Creators** or **8 Pro** subscribers for full break-even.

---

## 7. Recommended pricing structure

### 7.1 Subscription (primary revenue)

| Tier | ALGO/mo | INR | USD | Credits | Other limits |
|------|---------|-----|-----|---------|--------------|
| **Free** | 0 | ₹0 | $0 | 15 | 3 blogs, 2 projects, no video |
| **Creator** | **45** | ₹491 | $5.81 | 120 | 50 blogs, 10 projects, Medium/LinkedIn publish |
| **Pro** | **120** | ₹1,309 | $15.48 | 400 | Unlimited blogs/projects, all platforms |
| **Enterprise** | **350** | ₹3,819 | $45.15 | 1,500 | White-label, priority queue, SLA |

**Implementation mapping:** update `backend/src/constants/studioPlans.js` and `frontend/src/constants/studioPlans.js` `PLAN_PRICES` (microAlgos).

### 7.2 Pay-per-run overage (ALGO) — when credits exhausted

| Run type | Overage (ALGO) | ≈ INR | ≈ USD | Rationale (2.5× COGS floor) |
|----------|---------------|-------|-------|----------------------------|
| Lite (text) | 0.5 | ₹5.5 | $0.06 | COGS ~₹3 |
| Creative (image) | 2.5 | ₹27 | $0.32 | COGS ~₹15 |
| Agentic medium | 5 | ₹55 | $0.65 | COGS ~₹30 |
| Agentic full (video+audio) | **15** | ₹164 | $1.94 | COGS ~₹100 |

Charge via **burner wallet** or x402-style micro-payment (already partially implemented in `x402PaymentService.js`).

### 7.3 Marketplace / API (separate from Studio)

Keep **pay-per-token ALGO** to creators for marketplace APIs (existing model). Studio subscriptions are **platform access**, not marketplace inference.

| Stream | Mechanism | Platform take |
|--------|-----------|---------------|
| Creator API listings | P2P ALGO per call | 0% (P2P) or optional 2–5% protocol fee |
| Proof-of-intelligence log | 0.001 ALGO/call | 100% to protocol treasury |
| x402 agent calls | Min charge per service | Set per service |

---

## 8. Profit scenarios

### 8.1 Single Creator subscriber (month)

| Line | INR | USD |
|------|-----|-----|
| Revenue (45 ALGO) | ₹491 | $5.81 |
| Variable COGS (uses all 120 credits ≈ ₹280 blended) | −₹280 | −$3.31 |
| **Gross profit** | **₹211** | **$2.50** |
| Share of fixed costs (1/20 users) | −₹250 | −$2.96 |
| **Net (allocated)** | **−₹39** | **−$0.46** |

→ Need **~20 Creator subs** OR mix of Pro users to cover fixed + variable.

### 8.2 Target mix (monthly break-even ~₹5,000 costs)

| Subscribers | Mix | Revenue (INR) | Est. COGS | Gross profit |
|-------------|-----|---------------|-----------|--------------|
| 15 × Creator | 15 | ₹7,365 | ₹4,200 | ₹3,165 |
| 5 × Pro | 5 | ₹6,545 | ₹3,500 | ₹3,045 |
| **Total** | 20 | **₹13,910** | **₹7,700** | **₹6,210** |

After fixed ₹5,000 → **~₹1,210 net (~17% net margin)**. Acceptable early-stage; scale improves margin.

### 8.3 Your test week extrapolated

If **13 Agentic runs/week** at **₹28 gross COGS** each → **₹364/week ≈ ₹1,560/month** Google bill for **one power user**.

→ One power user needs **≥ Pro tier (120 ALGO)** or heavy overage billing.

---

## 9. ALGO / INR / USD price card (customer-facing)

Display on Studio Plan page (`StudioPlan.jsx`):

| Product | ALGO | INR (approx) | USD (approx) |
|---------|------|--------------|--------------|
| Creator subscription | 45 / mo | ₹491 / mo | $5.81 / mo |
| Pro subscription | 120 / mo | ₹1,309 / mo | $15.48 / mo |
| Enterprise subscription | 350 / mo | ₹3,819 / mo | $45.15 / mo |
| Extra text run | 0.5 | ₹5.5 | $0.06 |
| Extra image workflow | 2.5 | ₹27 | $0.32 |
| Extra full Agentic run | 15 | ₹164 | $1.94 |
| ClipCraft pack | 3 | ₹33 | $0.39 |

**Note to show users:** “INR/USD equivalents are indicative; ALGO amount is fixed at checkout. Rate updates weekly.”

---

## 10. Cost control & margin protection

1. **Block video/TTS on Free tier** — prevents ₹100+ COGS abuse.
2. **Rate-limit concurrent Agentic runs** — reduces 429 retries (your success rate dropped to 50% under load).
3. **Use Veo 3.1 Lite/Fast** for previews; Standard only on Pro+.
4. **Cap `maxOutputTokens`** on router/evaluator (already partially done).
5. **Cache memory embeddings** — reduce repeat embed calls.
6. **Pass Google Cloud billing alerts** at ₹500 / ₹1,000 / ₹2,000.
7. **Review savings credits monthly** — repricing when credits expire.

---

## 11. Implementation checklist (codebase)

| Task | File / area |
|------|-------------|
| Update subscription microAlgo prices | `backend/src/constants/studioPlans.js`, `frontend/src/constants/studioPlans.js` |
| Replace flat prompt limit with credit wallet | `backend/src/constants/studioLimits.js`, `User` model |
| Deduct credits per run type | `agenticOrchestrator.js`, `workflowExecutor.js`, `studioQuota.js` |
| Overage payment via burner / x402 | `x402PaymentService.js`, Workflow run flow |
| Show ALGO + INR + USD on plan page | `frontend/src/pages/studio/StudioPlan.jsx` |
| Admin COGS dashboard | New: log tokens + model per run |

### Suggested new env vars

```env
ALGO_USD_RATE=0.129          # refresh weekly
INR_USD_RATE=84.50           # refresh weekly
STUDIO_CREDIT_CREATOR=120
STUDIO_CREDIT_PRO=400
STUDIO_OVERAGE_AGENTIC_FULL_ALGO=15
```

---

## 12. Summary — why the model works

| Principle | Application |
|-----------|-------------|
| **Price on gross Google cost** | Your ₹165 credits mask true ₹367/week burn |
| **Weight by modality** | Text cheap; Veo+TTS expensive — one price fits none |
| **ALGO native, fiat reference** | Developers pay in ALGO; finance reports in INR/USD |
| **45–120 ALGO Creator/Pro** | Matches ₹300–₹1,000 COGS bands with margin |
| **Overage at 2.5× COGS** | Power users fund themselves |
| **Fixed costs need ~20 paid subs** | Render + DB + domain ≈ ₹5,000/mo |

---

## 13. Appendix — mapping your screenshots to models

| Screenshot metric | Model in Sentinel Studio |
|-------------------|-------------------------|
| Gemini 2.5 Flash TTS (~40 req) | Agentic audio agent, ClipCraft voiceover |
| Nano Banana / Flash Image (~39 req) | Prompt Generator, Agentic image, Workflow imageGen |
| Gemini 2.5 Flash (70K output tokens) | Router, text agent, evaluator, memory, blog |
| 429 / 503 errors | Rate limits — add queue + backoff |
| ₹165 peak day | ~3–13 Agentic/Workflow sessions |

---

*This model should be reviewed monthly against Google Cloud invoices and ALGO/INR spot rates. When moving from TestNet to MainNet, run a 30-day pilot with 5 beta users before locking MainNet prices.*

**Prepared for:** Sentinel / Zenith AI Studio rebuild  
**Contact:** wesentinal@gmail.com
