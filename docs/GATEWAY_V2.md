# Sentinel Gateway v2 — Complete Reference

## Architecture

Every proxied request: `POST /proxy/:slug/*` → 16-step pipeline → provider API.

| Layer | Role |
|-------|------|
| Redis | Live balance, rate limits, analytics counters |
| MongoDB | UsageRecord, LedgerTransaction, DeveloperEarning, DailyStats |
| BullMQ | Async writers + daily aggregation |
| Algorand | Deposits to vault + developer payouts only |

Legacy marketplace (`/api/use`, x402, direct ALGO to creator) remains active in parallel.

---

## Implemented features

### Phase 1 — Gateway core
- [x] 16-step middleware pipeline (`backend/src/gateway/pipeline.js`)
- [x] Consumer API keys (master + per-subscription)
- [x] Redis atomic balance lock / finalize / refund
- [x] UsageRecord + LedgerTransaction + DeveloperEarning (async)
- [x] Per-request and per-1000-tokens pricing
- [x] SSE streaming proxy with post-stream billing
- [x] Crash recovery (scheduler + worker job)
- [x] Platform fee 20% (`GATEWAY_PLATFORM_FEE_BPS`)

### Phase 2 — Dashboards
- [x] `GET /api/gateway/consumer/dashboard` (Redis + Mongo)
- [x] `GET /api/gateway/developer/dashboard`
- [x] `GET /api/gateway/usage-logs` (paginated)
- [x] Frontend: `/dashboard/gateway`, `/creator/gateway`

### Phase 3 — Analytics
- [x] Redis daily counters (calls, spend, revenue, tokens)
- [x] `DailyStats` model + nightly aggregation (00:05 UTC)
- [x] Token extraction (OpenAI + Anthropic shapes)

### Phase 4 — Algorand
- [x] Deposit instructions + `POST /api/gateway/deposit/confirm`
- [x] Vault deposit poller (30s default)
- [x] Developer payout `POST /api/gateway/developer/payout` (treasury → wallet)

### Phase 2 — Hardening, analytics, marketplace (complete)
- [x] Proxy audit: GET/POST/PUT/PATCH/DELETE, query string, header forwarding, retries, large bodies, SSE pipe
- [x] Billing only on HTTP 2xx–3xx; refunds on timeout/4xx/5xx
- [x] Traceability: `apiKeyPrefix`, `subscriptionId`, `projectId` on UsageRecord
- [x] Week/month Redis period counters
- [x] Consumer & developer Studio dashboards (period stats, billing history, API health)
- [x] Marketplace: categories, search, trending, popular (`/api/gateway/marketplace/*`)
- [x] Admin control center (`GET /api/gateway/admin/dashboard`) — requires `GATEWAY_ADMIN_USER_IDS` or `GATEWAY_ADMIN_WALLETS`
- [x] Alerts: low balance, high spend, high usage, monthly budget, API outage (scheduler health scan)
- [x] E2E audit: `node scripts/gateway-e2e-audit.mjs`, `GET /api/gateway/audit/health`
- [x] Frontend: `/dashboard/gateway`, `/dashboard/gateway-marketplace`, `/creator/gateway`, `/creator/gateway-admin`

### Phase 5 — Future
- [ ] Abuse detection worker
- [ ] Per-API configurable rate limits
- [ ] CSV export

---

## API endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gateway/apis` | Active ProxyApi catalog |
| GET | `/api/gateway/marketplace` | Home (trending, popular, featured) |
| GET | `/api/gateway/marketplace/search?q=&category=` | Search |
| GET | `/api/gateway/marketplace/trending` | Trending APIs |
| GET | `/api/gateway/marketplace/popular` | Popular APIs |
| ALL | `/proxy/:slug/*` | Gateway (requires API key) |

### Consumer (JWT)
| Method | Path |
|--------|------|
| POST | `/api/gateway/keys/issue` |
| GET | `/api/gateway/balance` |
| GET | `/api/gateway/deposit/instructions` |
| POST | `/api/gateway/deposit/confirm` `{ txId }` |
| POST | `/api/gateway/subscribe` `{ proxySlug }` |
| GET | `/api/gateway/consumer/dashboard` |
| GET | `/api/gateway/usage-logs` |
| GET/POST | `/api/gateway/alerts` |
| GET | `/api/gateway/audit/trace` | Consumer billing trace sample |

### Developer (JWT + creator)
| Method | Path |
|--------|------|
| GET | `/api/gateway/developer/dashboard` |
| GET | `/api/gateway/developer/earnings` |
| POST | `/api/gateway/developer/payout` `{ amountCents }` |
| GET | `/api/gateway/developer/payouts` |

### Admin (JWT + `GATEWAY_ADMIN_USER_IDS` or `GATEWAY_ADMIN_WALLETS`)
| Method | Path |
|--------|------|
| GET | `/api/gateway/admin/dashboard` |
| GET | `/api/gateway/audit/health` |

### Migration (creator + optional `X-Migration-Secret`)
| Method | Path |
|--------|------|
| GET | `/api/gateway/status` |
| POST | `/api/gateway/migrate/services` |
| POST | `/api/gateway/migrate/subscriptions` |
| POST | `/api/gateway/migrate/usage-logs` |

---

## Environment

```env
REDIS_URL=redis://...
GATEWAY_MIGRATION_SECRET=...
ALGO_USD_CENTS_PER_ALGO=35
GATEWAY_PLATFORM_FEE_BPS=2000
GATEWAY_RATE_LIMIT_PER_MIN=60
GATEWAY_MIN_PAYOUT_CENTS=500
GATEWAY_STREAM_COST_MULTIPLIER=2
GATEWAY_VAULT_ADDRESS=   # defaults to RECEIVER_WALLET
RECEIVER_WALLET=          # Algorand vault for deposits
PLATFORM_MNEMONIC=       # 24-word Pera Universal or 25-word Algorand
GATEWAY_ADMIN_USER_IDS=  # comma-separated Mongo user IDs
GATEWAY_ADMIN_WALLETS=   # comma-separated Algorand addresses
```

---

## Onboarding flow

1. Creator publishes service → auto-syncs to `ProxyApi`.
2. Creator runs migration (or relies on auto-sync).
3. Consumer opens **Gateway Wallet** → deposit ALGO → subscribe to slug.
4. Consumer calls:

```http
POST /proxy/{slug}/chat/completions
Authorization: Bearer sk-sentinel-...
Content-Type: application/json

{ "messages": [{ "role": "user", "content": "Hi" }] }
```

5. Developer views **Gateway v2** tab → requests payout in USD cents (paid in ALGO).

---

## Data mapping

| Legacy | v2 |
|--------|-----|
| `Service` | `ProxyApi` |
| `ApiUsageLog` | `UsageRecord` |
| `AccessToken` | `GatewaySubscription` |
| Creator on-chain withdraw | Still `/api/creator/withdraw` (usage-log based) |
| Gateway developer payout | `/api/gateway/developer/payout` (earning ledger) |

---

## File index

```
backend/src/gateway/          pipeline, stream, billing, cache, cost, errors
backend/src/services/         balance, deposit, payout, dashboard, migration, scheduler
backend/src/models/           ProxyApi, UsageRecord, GatewaySubscription, ...
backend/src/routes/gateway.js
backend/src/routes/proxy.js
backend/src/workers/gatewayWorker.js
frontend/src/pages/GatewayWallet.jsx
frontend/src/pages/GatewayDeveloper.jsx
```
