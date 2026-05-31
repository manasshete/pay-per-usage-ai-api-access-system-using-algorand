# SentinelAI: Production Setup & Operations Guide

Once your Sentinel frontend and backend services are deployed (e.g., on Render, Vercel, Heroku, or AWS), use this guide to configure environment variables, perform verification tests, and operate the platform.

---

## 1. Production Environment Variables Configuration

Ensure the following variables are configured in your hosting provider's dashboard:

### 🌐 Express Backend Service (`sentinal-backend`)

| Variable | Description | Example / Recommended |
|----------|-------------|-----------------------|
| `PORT` | Backend port (default `5000` locally, set automatically by Render) | `5000` |
| `MONGO_URI` | Production MongoDB Connection String | `mongodb+srv://...` |
| `REDIS_URL` | Production Redis URL (required for API caching, balances, and queues) | `redis://default:...` |
| `JWT_SECRET` | Secure string used to sign user auth tokens | *[Generate a 64-character random hex]* |
| `ALGO_USD_CENTS_PER_ALGO` | Conversion rate for credit purchases | `35` (represents $0.35 USD per ALGO) |
| `ALGOD_SERVER` | Algorand node endpoint | `https://mainnet-api.algonode.cloud` (or testnet) |
| `ALGO_INDEXER_URL` | Algorand indexer endpoint | `https://mainnet-idx.algonode.cloud` (or testnet) |
| `RECEIVER_WALLET` | The platform vault wallet. Pre-funded deposits are held here. | `ICM4Y4YVJWSBOV4LQIBXYV...` |
| `PLATFORM_MNEMONIC` | Mnemonic matching `RECEIVER_WALLET` (used to execute payouts) | `lecture rocket indicate ...` |

### ⚛️ Frontend React Service (`sentinal-frontend`)

| Variable | Description | Example / Recommended |
|----------|-------------|-----------------------|
| `VITE_API_URL` | URL of the deployed Express backend (no trailing slash) | `https://api.sentinalai.com` |
| `VITE_GOOGLE_API_KEY` | Firebase config key (for Google Authentication popup) | `AIzaSy...` |
| `VITE_GEMINI_MODEL` | Gemini AI model to use for workspace tools | `gemini-2.5-flash` |

---

## 2. Platform Operations Lifecycle

Follow these steps to initialize and start using the deployed platform:

### 🧑‍💻 Step 1: Register as a Creator
1. Open the frontend website.
2. Sign in via Google (this registers your user in MongoDB).
3. Connect your Algorand wallet (Pera Wallet / burner wallet) on the profile page.
4. Go to the dashboard and ensure your role is upgraded to **Creator**.

### 🚀 Step 2: Deploy AI Endpoints
1. On the **Creator Dashboard**, click **Add Endpoint**.
2. Fill out the service name, AI Provider (e.g. `groq`, `openai`, `gemini`), model name, and pricing:
   - **Legacy Price**: set in ALGO per 1,000 tokens (e.g. `0.025`).
   - **Gateway Price**: set in cents (e.g. `1` cent per call).
3. Save the endpoint. This will automatically sync it to the **Marketplace API Catalog** and configure the proxy gateway routes.

### 💳 Step 3: Fund Consumer Accounts
For consumers to make pre-funded gateway proxy calls:
1. Consumers open the **Gateway Wallet** page.
2. Connect their Algorand Wallet.
3. Input the amount of ALGO they wish to deposit (e.g. `10` ALGO) and click **Deposit**.
4. The system prompts Pera Wallet to sign the transaction. 
5. Once confirmed, the backend's deposit worker detects the transfer to `RECEIVER_WALLET` on-chain, and credits the consumer's Redis gateway balance (e.g., `10 ALGO * 35 cents = 350 cents` or `$3.50`).

### 🔑 Step 4: Subscribe & Invoke Proxies
1. Consumers browse the **Marketplace**, click on an API, and click **Subscribe**.
2. A subscription is created, and the consumer is issued a `sk-sentinel-...` API key.
3. Consumers invoke the API via standard client tools using their API key:
   ```bash
   curl -X POST "https://api.sentinalai.com/proxy/{proxy-slug}/chat/completions" \
     -H "Authorization: Bearer sk-sentinel-..." \
     -H "Content-Type: application/json" \
     -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
   ```
4. Cost is automatically calculated based on tokens consumed, locked, and deducted from their wallet balance.

### 💸 Step 5: Developer Payouts
1. Creators accumulate revenue inside their Developer Account.
2. Go to **Earnings & Payouts** on the Creator Dashboard.
3. Click **Withdraw**, enter the ALGO amount, and click submit.
4. The backend verifies their withdrawable balance, signs a transaction using `PLATFORM_MNEMONIC`, and transfers ALGO from the vault (`RECEIVER_WALLET`) directly to the creator's registered wallet address.

---

## 3. Recommended Smoke Tests Post-Deployment

Verify everything works by executing these curls against your live backend domain:

### 1️⃣ Health Check
```bash
curl https://api.sentinalai.com/api/health
# Expected Output: {"ok":true}
```

### 2️⃣ API Catalog Stats (Graceful fallback test)
```bash
curl https://api.sentinalai.com/api/contract/stats
# Expected: Returns 200 OK with active services list and platform counters.
# If smart contracts are not deployed on mainnet, "configured" will show false, but the page must not throw a 500 error.
```

### 3️⃣ E2E Request Verification Check
To verify that billing and ledger tracking are connected, query the audit route with a request ID:
```bash
curl -H "Authorization: Bearer <your-auth-token>" \
  "https://api.sentinalai.com/api/gateway/e2e-verify?requestId=<request-id>"
# Expected: Returns a full JSON lifecycle tree demonstrating UsageRecord, billing deductions, and developer payouts.
```
