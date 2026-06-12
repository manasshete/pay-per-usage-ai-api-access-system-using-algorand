# SentinelAI — Smart Contracts: Complete Guide & Judge Q&A

> **Project:** Sentinel (SentinelAI) — Pay-Per-Usage AI API Access System on Algorand  
> **Team:** Aarya Pawar, Manas Shete, Debjit Debnath, Aayush Lathi  
> **Network:** Algorand TestNet  
> **Contract:** `SentinelContract` (Puya / algopy, ARC-4)

This document explains everything about smart contracts in the context of SentinelAI, how our project uses them, and provides detailed questions and answers that judges commonly ask during hackathons and project presentations.

---

## Table of Contents

1. [What Is a Smart Contract?](#1-what-is-a-smart-contract)
2. [Algorand Smart Contracts](#2-algorand-smart-contracts)
3. [SentinelContract — Full Breakdown](#3-sentinelcontract--full-breakdown)
4. [How Sentinel Uses Blockchain](#4-how-sentinel-uses-blockchain)
5. [Architecture & Design Decisions](#5-architecture--design-decisions)
6. [Deployment & Configuration](#6-deployment--configuration)
7. [Core Flows (Step-by-Step)](#7-core-flows-step-by-step)
8. [Backend & Frontend Integration](#8-backend--frontend-integration)
9. [Security Model](#9-security-model)
10. [On-Chain vs Off-Chain Data](#10-on-chain-vs-off-chain-data)
11. [Judge Q&A — Basics](#11-judge-qa--basics)
12. [Judge Q&A — Technical Depth](#12-judge-qa--technical-depth)
13. [Judge Q&A — Security & Trust](#13-judge-qa--security--trust)
14. [Judge Q&A — Business & Product](#14-judge-qa--business--product)
15. [Judge Q&A — Deployment & Production](#15-judge-qa--deployment--production)
16. [Judge Q&A — Hard / Curveball Questions](#16-judge-qa--hard--curveball-questions)
17. [One-Minute Elevator Pitch](#17-one-minute-elevator-pitch)
18. [Demo Checklist for Judges](#18-demo-checklist-for-judges)
19. [Glossary](#19-glossary)
20. [Related Files in This Repository](#20-related-files-in-this-repository)

---

## 1. What Is a Smart Contract?

A **smart contract** is program code stored **on a blockchain** that runs automatically when certain conditions are met. It behaves like a **vending machine on the blockchain**: you insert cryptocurrency, the program checks the rules, and then it either executes the agreed action or rejects the transaction.

### 1.1 Key Properties

| Property | Meaning |
|----------|---------|
| **Immutable** | Once deployed, the on-chain logic cannot be secretly changed by the developer |
| **Transparent** | Anyone can read the contract code and inspect its state on a block explorer |
| **Deterministic** | Same inputs always produce the same result on every network node |
| **Trustless** | Parties do not need to trust each other; they trust the code and the blockchain consensus |
| **Atomic** | Multiple related steps can succeed together or fail together (critical on Algorand) |

### 1.2 Smart Contract vs Regular Payment

| Aspect | Regular ALGO Transfer | Smart Contract |
|--------|----------------------|----------------|
| **Who enforces rules?** | Sender and receiver manually | On-chain program |
| **Can you add logic?** | Only amount + optional note | Full conditional logic, counters, validations |
| **State storage** | Wallet balance only | Global and local state variables on the app |
| **Example in Sentinel** | User pays creator 0.5 ALGO for an AI call | Contract tracks total purchases and total ALGO received |

### 1.3 When Do You Need a Smart Contract?

Use a smart contract when you need:

- **Enforced rules** that cannot be bypassed (minimum payment, valid receiver, counters)
- **Shared global state** visible to everyone (platform statistics)
- **Atomic multi-step operations** (payment + state update in one indivisible unit)
- **Auditability** without trusting a central database

You do **not** need a smart contract for every blockchain interaction. Simple peer-to-peer payments can be verified off-chain using the Algorand Indexer — which is exactly what Sentinel does for marketplace AI calls.

---

## 2. Algorand Smart Contracts

SentinelAI is built on **Algorand**, a Layer-1 blockchain designed for fast, low-cost transactions. This makes it well-suited for **pay-per-use micropayments** where users may pay small amounts of ALGO per AI API call.

### 2.1 Why Algorand for Pay-Per-Use AI?

| Feature | Benefit for Sentinel |
|---------|---------------------|
| **~3.3 second block time** | Near-instant payment confirmation before AI response delivery |
| **Fixed low fees (~0.001 ALGO)** | Micropayments remain economical |
| **No gas auctions** | Predictable costs unlike Ethereum-style networks |
| **Atomic Transaction Groups** | Payment + app call can be bundled safely |
| **Pure Proof-of-Stake** | Energy-efficient, scalable foundation |

### 2.2 Types of Algorand Smart Contracts

1. **Logic Signatures (LogicSig)** — Simple delegated approval rules; not used in Sentinel's main contract flow.
2. **Application (Stateful) Smart Contracts** — Full programs with global/local state. **This is what `SentinelContract` is.**

### 2.3 Our Contract Technology Stack

```
Python (Puya / algopy)
        ↓
      TEAL (Transaction Execution Approval Language)
        ↓
   Bytecode (via Algod compile endpoint)
        ↓
Deployed Application on Algorand TestNet
        ↓
App ID + Application Address
```

| Technology | Role |
|------------|------|
| **Puya / algopy** | Write contracts in Python (`contract/sentinel_contract.py`) |
| **TEAL** | Algorand's stack-based low-level language (compiled intermediate) |
| **ARC-4** | ABI standard so wallets and backends can call methods by name |
| **App ID** | Unique numeric identifier assigned at deployment |
| **Application Address** | Derived Algorand address where the app can receive ALGO |

### 2.4 Important Algorand Concepts

#### Application Address

Every deployed application has its own Algorand address, computed from its App ID. Users can send ALGO to this address. Our TestNet contract address:

```text
F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
```

#### Global State

Variables stored inside the application on-chain. `SentinelContract` uses **3 uint64 global state values**:

- `min_payment`
- `total_purchases`
- `total_algo_received`

#### Atomic Transaction Group

Two or more Algorand transactions submitted together where **all succeed or all fail**. Our `purchase()` method requires a Payment transaction in the **same atomic group** as the application call. This prevents the contract from accepting a fake or unrelated payment reference.

#### Read-Only vs State-Changing Methods

| Method Type | Example | Effect |
|-------------|---------|--------|
| **Read-only** | `read_stats()` | Returns data; does not modify global state |
| **State-changing** | `purchase()` | Updates counters on-chain |

#### MicroAlgos

Algorand's smallest unit. **1 ALGO = 1,000,000 microAlgos.**

---

## 3. SentinelContract — Full Breakdown

### 3.1 Source File

**Location:** `contract/sentinel_contract.py`

```python
class SentinelContract(
    ARC4Contract,
    state_totals=StateTotals(global_uints=3, global_bytes=0),
):
    """Accepts grouped Payment + App call; tracks purchases and ALGO received in global state."""

    def __init__(self) -> None:
        self.min_payment = UInt64(0)
        self.total_purchases = UInt64(0)
        self.total_algo_received = UInt64(0)

    @arc4.abimethod(create="require")
    def create_application(self, min_amount: arc4.UInt64) -> None:
        """Set minimum payment (microAlgos) on deploy."""
        self.min_payment = min_amount.native
        self.total_purchases = UInt64(0)
        self.total_algo_received = UInt64(0)

    @arc4.abimethod
    def purchase(self, pay: gtxn.PaymentTransaction) -> None:
        """Process a valid top-up: Payment txn must be in the atomic group (reference arg)."""
        assert pay.receiver == Global.current_application_address, "receiver must be app account"
        assert pay.amount >= self.min_payment, "below minimum"
        self.total_purchases += UInt64(1)
        self.total_algo_received += pay.amount

    @arc4.abimethod(readonly=True)
    def read_stats(self) -> tuple[arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Return (min_payment, total_purchases, total_algo_received_micro)."""
        return (
            arc4.UInt64(self.min_payment),
            arc4.UInt64(self.total_purchases),
            arc4.UInt64(self.total_algo_received),
        )
```

### 3.2 Global State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `min_payment` | uint64 | Minimum allowed top-up amount in microAlgos (set at deploy) |
| `total_purchases` | uint64 | Counter: how many valid `purchase()` calls have executed |
| `total_algo_received` | uint64 | Cumulative ALGO received via valid purchases (in microAlgos) |

### 3.3 Methods

| Method | ARC-4 Signature | When Called | What It Does |
|--------|----------------|-------------|--------------|
| `create_application` | `create_application(uint64)` | Once at deployment | Sets `min_payment`, initializes counters to zero |
| `purchase` | `purchase(pay)` | User top-up | Validates grouped payment; increments counters |
| `read_stats` | `read_stats()` | Anytime (read-only) | Returns `(min_payment, total_purchases, total_algo_received)` |

### 3.4 Security Checks in `purchase()`

1. **`pay.receiver == Global.current_application_address`**  
   Ensures ALGO is sent to the contract's application address, not an arbitrary wallet.

2. **`pay.amount >= self.min_payment`**  
   Rejects payments below the configured minimum (prevents dust/spam).

3. **`gtxn.PaymentTransaction` reference argument**  
   The payment must be in the **same atomic transaction group** as the app call. The contract cryptographically references that specific payment — you cannot pass an old or unrelated transaction.

### 3.5 What the Contract Does NOT Do

Being honest with judges is important. Our contract intentionally does **not**:

- Run AI inference (impossible on-chain at practical cost)
- Store API keys or full prompts/responses
- Escrow creator payments for marketplace calls
- Automatically split revenue between platform and creators
- Upgrade itself after deployment

It is a **focused MVP contract** for transparent aggregate statistics and validated top-ups.

### 3.6 Current TestNet Deployment

```text
App ID:           763786783
Contract Address: F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
Network:          Algorand TestNet
Min Payment:      1 ALGO (1,000,000 microAlgos)
Algod Server:     https://testnet-api.algonode.cloud
```

Verify without spending ALGO:

```bash
npm ci --prefix cli
npm run contract:verify -- --app-id 763786783 \
  --contract-address F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
```

---

## 4. How Sentinel Uses Blockchain

Sentinel uses **multiple on-chain mechanisms**, not only the smart contract. This hybrid design is deliberate and practical for an AI marketplace.

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKETPLACE AI CALLS (Primary)               │
│                                                                 │
│  User Wallet ──P2P ALGO──► Creator Wallet                       │
│       │                                                         │
│       └──► Backend verifies via Algorand Indexer                │
│                 │                                               │
│                 └──► Optional Proof-of-Intelligence tx          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              CONTRACT TOP-UP (Smart Contract Flow)              │
│                                                                 │
│  User Wallet ──Atomic Group──► SentinelContract                 │
│     (Payment + purchase() app call)                             │
│                 │                                               │
│                 └──► Updates global state counters              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM VISIBILITY                          │
│                                                                 │
│  On-chain globals + MongoDB usage logs                          │
│       │                                                         │
│       └──► GET /api/contract/stats                              │
│       └──► GET /api/contract/activity                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Flow 1 — Pay-Per-Use AI Call (Primary Marketplace Flow)

This is the **main revenue flow** for creators. It does **not** require the smart contract.

**Step 1 — Quote:**
1. User writes a prompt on the service detail page.
2. Frontend shows live cost estimate via token pricing logic.
3. User clicks Send → `POST /api/use` with messages.
4. Backend validates access, calls AI provider (Groq/OpenAI/Anthropic/Together), computes exact ALGO charge.
5. Backend returns `{ awaitingPayment: true, paymentRef, chargeAlgo, developerWallet }`.

**Step 2 — Pay & Complete:**
6. User clicks Pay → Pera Wallet opens.
7. User signs Algorand payment:
   - **From:** user wallet
   - **To:** creator wallet (`developerWallet`)
   - **Amount:** `chargeAlgo` in microAlgos
   - **Note:** `paymentRef` (UUID)
8. Frontend calls `POST /api/use` with `{ txId, paymentRef }`.
9. Backend:
   - Checks for replay (txId already used)
   - Retrieves cached AI session by `paymentRef`
   - Polls Algorand Indexer for the transaction
   - Validates sender, receiver, amount (±1%), note
   - Creates `ApiUsageLog` with `success: true`
   - Asynchronously submits proof-of-intelligence transaction
   - Returns AI response + receipt
10. User sees the AI response.

### 4.3 Flow 2 — Contract Top-Up (Smart Contract Flow)

Used for on-chain platform statistics and the Smart Contract demo page.

1. `POST /api/wallet/topup/create` — backend reads `min_payment` from on-chain contract.
2. Returns `{ paymentIntentId, receiver: contractAddress, amountMicroAlgos, note }`.
3. User signs payment via Pera Wallet.
4. **For counters to increment:** user must submit an **atomic group** containing:
   - Payment transaction → contract application address
   - App call → `purchase(pay)`
5. `POST /api/wallet/topup/verify` with `{ txId, paymentIntentId }`.
6. Backend verifies on Indexer: receiver = contract address, amount ≥ minimum.
7. `TopUpIntent` marked as verified.

**Important:** A simple payment to the contract address **without** calling `purchase()` may increase the app account balance but **will not increment** `total_purchases` or `total_algo_received`. Our API returns an explicit ABI hint about this.

### 4.4 Flow 3 — Proof-of-Intelligence (On-Chain Attestation)

After a successful metered AI call, the platform optionally logs an immutable attestation:

1. Backend computes SHA-256 of: `prompt|response|userWallet|serviceId|timestamp`
2. Platform wallet sends **0.001 ALGO** (1000 microAlgos) to `PROOF_LOG_ADDRESS`
3. Transaction note: `proof of intelligence:<sha256hex>`
4. Transaction ID stored in `ApiUsageLog.proofTxId`

This creates a **tamper-evident on-chain record** that an AI interaction occurred, without storing full prompt/response text on-chain (cost and privacy).

**Implementation:** `backend/src/services/proofOfIntelligence.js`

### 4.5 Flow 4 — x402 Payment Protocol

HTTP **402 Payment Required** enables AI agents to pay programmatically:

1. Agent calls API → receives 402 with payment requirements
2. Agent pays on-chain (ALGO to creator)
3. Agent retries with payment proof (`txId`)
4. Backend verifies on Indexer → returns AI response

Same trust model as manual Pera Wallet flow; designed for **machine-native commerce**.

**Implementation:** `backend/src/routes/x402.js`

### 4.6 Flow 5 — Direct Payment & Access Token

Alternative to metered per-call billing:

1. User clicks "Buy Access" on a service
2. `POST /api/payment/create` → payment intent
3. User pays creator via Pera Wallet
4. `POST /api/payment/verify` → backend verifies on-chain
5. User receives `sk-sentinel-<hex>` API key for subsequent calls

### 4.7 Flow 6 — Burner Wallet (Automated Payments)

A hot Algorand wallet stored locally (mnemonic in `localStorage`) for automated/agent payments without manual Pera signing per transaction:

1. Frontend generates or loads burner wallet mnemonic
2. Optional encrypted sync to MongoDB via `POST /api/profile/burner`
3. User funds burner from Pera Wallet
4. Automated clients sign transactions directly with burner secret key
5. On logout/reset, remaining ALGO can be refunded via `closeRemainderTo`

---

## 5. Architecture & Design Decisions

### 5.1 Why Not Put Everything in the Smart Contract?

| Design Choice | Reason |
|---------------|--------|
| **P2P payments to creators** | Creators receive 100% revenue instantly; no escrow complexity or withdrawal step |
| **Smart contract for stats/top-ups** | Transparent, tamper-proof platform metrics anyone can audit |
| **Backend verification via Indexer** | AI inference requires off-chain compute; blockchains cannot run LLMs practically |
| **Proof-of-intelligence hashes** | Cheap on-chain audit trail without storing full conversation on-chain |
| **TestNet first** | Safe iteration; MainNet requires real ALGO and stricter operational review |

### 5.2 Business Model Summary

| Participant | Role | Revenue |
|-------------|------|---------|
| **Creators** | Publish AI services, set per-token ALGO pricing | Receive 100% of user marketplace payments directly |
| **Users** | Consume AI services pay-per-call | Pay in ALGO — no subscription required for marketplace |
| **Platform** | Marketplace + AI Studio | Studio subscription tiers; 0.001 ALGO proof-of-intelligence fee per call |

**Key property:** Zero platform cut on marketplace transactions — ALGO flows user → creator directly.

### 5.3 Hybrid Web2 + Web3 Model

Sentinel is honestly **hybrid**:

- **Decentralized:** ALGO payments, contract state, proof hashes, public verifiability via Indexer/explorers
- **Centralized:** AI inference, encrypted API key storage, user sessions (JWT), MongoDB usage logs

This is a **pragmatic and common** architecture for AI marketplaces in 2024–2026.

---

## 6. Deployment & Configuration

### 6.1 Compile the Contract

```powershell
cd contract
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m puyapy sentinel_contract.py --out-dir artifacts
cd ..
```

### 6.2 Deploy to TestNet

```powershell
$env:DEPLOYER_MNEMONIC="your 25 word Algorand mnemonic"
$env:SENTINEL_MIN_MICRO_ALGOS="1000000"

npm.cmd ci --prefix cli
npm.cmd run contract:deploy -- --network testnet

Remove-Item Env:DEPLOYER_MNEMONIC
```

**Never** put `DEPLOYER_MNEMONIC` in Render, Git, frontend env, logs, or chat.

### 6.3 Backend Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ALGO_APP_ID` | Yes (for contract features) | Deployed application ID |
| `ALGO_CONTRACT_ADDRESS` | Yes | Application address for payments |
| `ALGOD_SERVER` | Yes | Algod node URL |
| `ALGOD_TOKEN` | Optional | Node API token if needed |
| `TOPUP_MIN_MICRO_ALGOS` | Optional | Override minimum top-up |
| `PLATFORM_MNEMONIC` | Optional | For proof-of-intelligence txs |
| `PROOF_LOG_ADDRESS` | Optional | Receiver for proof txs |

### 6.4 MainNet Deployment

MainNet deployment requires explicit confirmation:

```powershell
npm.cmd run contract:deploy -- --network mainnet --yes-mainnet
```

Deploying a changed contract creates a **new App ID**. Old application state is **not migrated automatically**.

### 6.5 Post-Deploy Verification

```text
GET /api/health
GET /api/contract/stats?refresh=1
```

Expected response includes:
- `configured: true`
- Correct App ID and contract address
- `minPaymentAlgo: 1` (when deployed with 1,000,000 microAlgos)

See also: `docs/CONTRACT_DEPLOYMENT.md`

---

## 7. Core Flows (Step-by-Step)

### 7.1 Atomic Group for `purchase()` — Detailed

For contract counters to increment, the wallet must submit **two transactions in one atomic group**:

**Transaction 1 — Payment:**
- Sender: user wallet
- Receiver: contract application address
- Amount: ≥ `min_payment` microAlgos

**Transaction 2 — Application Call:**
- Application ID: `763786783`
- Method: `purchase(pay)`
- References: Transaction 1 as the `pay` argument

If either transaction fails validation, **both are rejected** — no partial state update.

### 7.2 Backend Payment Verification — Detailed

When verifying marketplace payments (`/api/use`, `/api/payment/verify`, x402):

1. Look up transaction on Algorand Indexer (with retry)
2. Confirm transaction is confirmed on-chain
3. Validate **sender** matches expected user wallet
4. Validate **receiver** matches creator wallet or expected address
5. Validate **amount** within tolerance (±1%)
6. Validate **note** matches `paymentRef` or payment intent ID
7. Check **replay protection** — txId not already used in `ApiUsageLog`
8. Mark usage log as successful and release cached AI response

---

## 8. Backend & Frontend Integration

### 8.1 Backend Services

| File | Purpose |
|------|---------|
| `backend/src/config/contractConfig.js` | Reads `ALGO_APP_ID`, `ALGO_CONTRACT_ADDRESS` from env or `contract/contract_info.json` |
| `backend/src/services/contractAlgod.js` | Reads global state via Algod `getApplicationByID` |
| `backend/src/services/platformStats.js` | Combines on-chain stats + MongoDB aggregations |
| `backend/src/routes/contract.js` | `GET /api/contract/stats`, `GET /api/contract/activity` |
| `backend/src/routes/wallet.js` | Top-up create/verify endpoints |
| `backend/src/services/proofOfIntelligence.js` | Submits proof hash transactions |

### 8.2 API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/contract/stats` | Public | On-chain + platform statistics (20s cache) |
| `GET /api/contract/stats?refresh=1` | Public | Force refresh from Algod |
| `GET /api/contract/activity` | Public | Recent usage activity with explorer links |
| `POST /api/wallet/topup/create` | Auth | Create top-up intent with contract address |
| `POST /api/wallet/topup/verify` | Auth | Verify top-up transaction on Indexer |

### 8.3 Frontend Components

| Component | Purpose |
|-----------|---------|
| `ContractStats.jsx` | Displays on-chain contract statistics |
| `wallet/pera.js` | Pera Wallet connect + sign payment transactions |
| Smart Contract page | Test purchase action (atomic group) |

### 8.4 Reading Contract State (Backend Logic)

`readContractGlobalUints()` in `contractAlgod.js`:

1. Calls Algod `getApplicationByID(appId)`
2. Parses global state key-value pairs
3. Extracts `min_payment`, `total_purchases`, `total_algo_received`
4. Returns values in microAlgos for display conversion

---

## 9. Security Model

### 9.1 Payment Security

| Mechanism | Description |
|-----------|-------------|
| **Indexer verification** | Every payment verified against on-chain truth, not client claims |
| **Replay protection** | Same `paymentTxId` cannot be reused for multiple API calls |
| **Amount tolerance** | ±1% to handle rounding; rejects significantly underpaid txns |
| **Note matching** | Payment note must match server-issued `paymentRef` or intent ID |
| **Non-custodial marketplace** | Platform does not hold creator earnings |

### 9.2 Smart Contract Security

| Property | SentinelContract |
|----------|------------------|
| **Minimal attack surface** | No external calls, no reentrancy, no token approvals |
| **Explicit asserts** | Only two conditions in `purchase()` |
| **Atomic group requirement** | Cannot fake payment reference |
| **Immutable after deploy** | No admin backdoor to change rules |

### 9.3 Off-Chain Security

| Asset | Protection |
|-------|------------|
| Creator API keys | AES-256-GCM encryption at rest |
| User sessions | JWT with expiry; 401 clears stale sessions |
| Burner mnemonics | Local storage + optional encrypted server sync |
| Platform mnemonic | Server env only; never exposed to frontend |

### 9.4 What Attackers Cannot Easily Do

- Reuse a single payment for multiple AI responses (replay check)
- Redirect creator payment to wrong wallet (receiver validation)
- Increment contract counters without valid grouped payment (contract asserts)
- Read creator API keys from blockchain (never stored on-chain)

---

## 10. On-Chain vs Off-Chain Data

| Stored On-Chain | Stored Off-Chain |
|-----------------|------------------|
| ALGO payment transactions | Full AI prompts and responses |
| Contract global counters | Encrypted provider API keys |
| Proof-of-intelligence hashes | User profiles and JWT sessions |
| Payment notes (`paymentRef`) | Usage analytics and predictions |
| Application bytecode (immutable) | Workflow templates metadata |
| Top-up intents (verified status in DB) | Creator webhook configurations |

---

## 11. Judge Q&A — Basics

### Q1: What is a smart contract in your project?

**Answer:** We deployed `SentinelContract` on Algorand TestNet. It tracks the minimum top-up amount, total purchases, and total ALGO received. It enforces payment rules on-chain using atomic transaction groups — a Payment transaction bundled with an App call to `purchase()`.

---

### Q2: Why Algorand and not Ethereum?

**Answer:** Algorand offers approximately 3.3-second finality, very low fixed transaction fees (~0.001 ALGO), and no gas price auctions. For pay-per-use micropayments where users may pay small ALGO amounts per AI call, Algorand is more practical and cost-predictable than Ethereum mainnet.

---

### Q3: What language did you write the contract in?

**Answer:** Python using Puya/algopy. It compiles to TEAL, then to bytecode via the Algod compile endpoint. We follow ARC-4 for ABI-compatible method signatures so wallets and our frontend can call methods by name.

---

### Q4: What is your App ID and how can we verify it?

**Answer:** App ID `763786783` on Algorand TestNet. Contract address: `F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM`. Verify via:
- `GET /api/contract/stats?refresh=1` on our backend
- [TestNet AlgoExplorer](https://testnet.algoexplorer.io/application/763786783)
- CLI: `npm run contract:verify -- --app-id 763786783 --contract-address F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM`

---

### Q5: What problem does your smart contract solve?

**Answer:** It provides **transparent, tamper-proof platform statistics** on-chain that anyone can audit without trusting our database. It also validates top-up payments with enforced minimum amounts and atomic payment binding — a foundation for future on-chain escrow or subscription features.

---

### Q6: Who are the stakeholders in your system?

**Answer:**
- **Users** — consume AI APIs, pay per call in ALGO
- **Creators** — publish services, receive direct payments
- **Platform (Sentinel)** — runs marketplace, Studio, verification, optional proof logging
- **Algorand network** — settles payments, stores contract state

---

## 12. Judge Q&A — Technical Depth

### Q7: Explain the `purchase()` method in detail.

**Answer:** `purchase(pay)` accepts a referenced Payment transaction from the same atomic group. It asserts:
1. `pay.receiver` equals the application's own address
2. `pay.amount` is at least `min_payment`

If both pass, it increments `total_purchases` by 1 and adds `pay.amount` to `total_algo_received`. If either assert fails, the entire atomic group fails and no state changes.

---

### Q8: What is an atomic transaction group?

**Answer:** A set of 2–16 Algorand transactions submitted together where all succeed or all fail. We use it to bundle a Payment with an App call so the contract can cryptographically verify the payment during the same execution — preventing fake or stale payment references.

---

### Q9: What happens if someone sends ALGO to the contract without calling `purchase()`?

**Answer:** The application account's ALGO balance increases, but `total_purchases` and `total_algo_received` do **not** update because the contract logic never executed. Our API and UI document that users need the atomic group (Payment + `purchase()`) for counters to increment.

---

### Q10: How does the backend read contract state?

**Answer:** Via Algod's `getApplicationByID` API. We parse global state keys (`min_payment`, `total_purchases`, `total_algo_received`) in `backend/src/services/contractAlgod.js` and expose combined platform + on-chain stats at `GET /api/contract/stats`.

---

### Q11: Can the contract be upgraded after deployment?

**Answer:** No. The approval program is immutable once deployed. To change logic, we deploy a **new** application with a new App ID and update environment variables (`ALGO_APP_ID`, `ALGO_CONTRACT_ADDRESS`). Old state is not automatically migrated.

---

### Q12: What is TEAL?

**Answer:** Transaction Execution Approval Language — Algorand's stack-based smart contract language. Puya compiles our Python source to TEAL; Algod then compiles TEAL to bytecode stored on-chain. TEAL is auditable; most developers write in higher-level languages like Python (Puya) or Reach.

---

### Q13: What is ARC-4?

**Answer:** Algorand's ABI convention for naming and encoding contract methods. It lets tools decode method calls like `purchase(pay)` and `read_stats()` consistently — similar to Ethereum's ABI but Algorand-native.

---

### Q14: What is the difference between Algod and the Indexer?

**Answer:**
- **Algod** — Full node API; submits transactions, reads application state, compiles TEAL
- **Indexer** — Read-optimized API; searches historical transactions by address, note, txId

We use Algod for contract global state and transaction submission; Indexer for verifying user payment transactions.

---

### Q15: How does `read_stats()` work?

**Answer:** It is a **read-only** ARC-4 method that returns a tuple of three uint64 values: minimum payment, total purchases, and total ALGO received (microAlgos). It does not modify state and can be called without spending ALGO beyond the minimal app call fee.

---

### Q16: What compiled artifacts does the contract produce?

**Answer:**

| File | Purpose |
|------|---------|
| `SentinelContract.approval.teal` | Main contract logic |
| `SentinelContract.clear.teal` | Clear-state program (minimal) |
| `SentinelContract.arc56.json` | Extended ABI + state layout |
| `*.puya.map` | Source maps linking TEAL to Python |

---

## 13. Judge Q&A — Security & Trust

### Q17: How do you prevent payment replay attacks?

**Answer:** Before accepting any `txId`, we query MongoDB (`ApiUsageLog`) to ensure that transaction ID has not already been used for a successful API call or payment verification. Each on-chain payment can only unlock one service delivery.

---

### Q18: How exactly do you verify payments?

**Answer:**
1. Poll Algorand Indexer for the transaction (with retry)
2. Confirm on-chain confirmation
3. Validate sender = expected user wallet
4. Validate receiver = expected creator or contract address
5. Validate amount within ±1% tolerance
6. Validate note matches server-issued reference ID
7. Reject if txId already consumed

---

### Q19: Is your platform custodial?

**Answer:** For marketplace AI calls, **no**. Users pay creators directly peer-to-peer. The platform never holds creator earnings. The burner wallet is user-controlled (mnemonic in browser local storage). The platform wallet is only used for proof-of-intelligence logging and Studio subscription flows — not for marketplace revenue.

---

### Q20: Where are creator API keys stored? Why not on-chain?

**Answer:** Off-chain in MongoDB, encrypted with AES-256-GCM. Putting API keys on a public blockchain would expose them to everyone permanently — that would be a critical security failure. AI inference must happen off-chain regardless.

---

### Q21: What if the backend lies about AI responses?

**Answer:** We submit an optional **proof-of-intelligence** transaction: a SHA-256 hash of prompt, response, user wallet, service ID, and timestamp is stored on-chain in the transaction note. Users can prove an interaction occurred at a specific time. Full text stays off-chain for cost and privacy, but the hash is tamper-evident.

---

### Q22: What smart contract vulnerabilities did you consider?

**Answer:** Our contract is intentionally minimal — no reentrancy (no external calls), no delegatecall patterns, no complex token logic. Only two asserts and counter increments. Smaller contracts have smaller attack surfaces than complex DeFi protocols.

---

### Q23: How do you protect the deployer and platform mnemonics?

**Answer:**
- `DEPLOYER_MNEMONIC` — used only locally at deploy time; never in Render, Git, or frontend
- `PLATFORM_MNEMONIC` — backend server environment only; used for proof-of-intelligence txs
- Frontend never receives server-side mnemonics

---

## 14. Judge Q&A — Business & Product

### Q24: Why isn't every AI payment going through the smart contract?

**Answer:** LLM inference is off-chain by necessity. Escrowing every micropayment on-chain would add latency, wallet UX friction, and cost. Peer-to-peer ALGO payment with Indexer verification is faster for creators who receive funds instantly. The smart contract provides transparent aggregate metrics and a path for future escrow features.

---

### Q25: How do creators get paid?

**Answer:** 100% of the quoted ALGO amount goes directly to the creator's Algorand wallet address. Zero platform cut on marketplace transactions.

---

### Q26: How does the burner wallet work?

**Answer:** A hot Algorand wallet generated in the browser for automated payments — useful for agents and repeated calls without signing each transaction in Pera Wallet. The mnemonic is stored locally; optionally synced encrypted to the user's backend profile.

---

### Q27: What is x402 and why does it matter?

**Answer:** x402 is the HTTP 402 "Payment Required" pattern for programmatic payments. AI agents can call Sentinel APIs, receive payment instructions, pay on-chain, and retry with proof — enabling **machine-native commerce** without custom Sentinel client SDKs.

---

### Q28: What is AI Studio vs Marketplace?

**Answer:**
- **Marketplace** — creators publish AI services; users pay per call
- **AI Studio** — workflow builder, templates, subscriptions for creators (Creator 5 ALGO/mo, Pro 15, Enterprise 40)

The smart contract primarily supports platform-wide stats and top-up demos; marketplace billing is P2P.

---

### Q29: How is this different from OpenRouter or RapidAPI?

**Answer:** Sentinel adds **on-chain payment verification**, **non-custodial creator payouts**, **Algorand micropayments**, **proof-of-intelligence audit trail**, and **agent-ready x402** — positioning it as a crypto-native, verifiable AI API marketplace rather than a traditional fiat API aggregator.

---

## 15. Judge Q&A — Deployment & Production

### Q30: TestNet vs MainNet — where are you today?

**Answer:** TestNet (chain ID 416002). MainNet deployment is supported via CLI with explicit `--yes-mainnet` flag. MainNet would require real ALGO, production Algod endpoints, and operational review of all addresses and amounts.

---

### Q31: What environment variables connect the backend to the contract?

**Answer:**
```text
ALGO_APP_ID=763786783
ALGO_CONTRACT_ADDRESS=F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
ALGOD_SERVER=https://testnet-api.algonode.cloud
```

The frontend receives contract configuration from the backend API — no contract-specific frontend env vars required.

---

### Q32: How much does deployment cost?

**Answer:** Application creation fee plus Algorand minimum balance requirement for global state (3 uint64 values). On TestNet, the deployer account is funded via the TestNet faucet. Exact cost depends on current network parameters and account MBR.

---

### Q33: How do you demo the contract live to judges?

**Answer:**
1. Open the Smart Contract page in the frontend
2. Show live stats from `/api/contract/stats`
3. Click **Test purchase** — submits atomic group (Payment + `purchase()`)
4. Refresh stats — `total_purchases` and `total_algo_received` increment
5. Open AlgoExplorer link to show on-chain transaction

---

### Q34: What happens when you redeploy a new contract?

**Answer:** A new App ID and application address are created. You must update `ALGO_APP_ID`, `ALGO_CONTRACT_ADDRESS`, and `render.yaml`. Historical state on the old application remains on-chain but is no longer used by the backend.

---

## 16. Judge Q&A — Hard / Curveball Questions

### Q35: Why use a smart contract at all if the backend verifies payments?

**Answer:** The contract provides **trustless, public, tamper-proof aggregate statistics** auditable by anyone without trusting MongoDB. It also demonstrates Algorand smart contract integration and provides a foundation for future on-chain escrow, revenue splits, or subscription logic.

---

### Q36: Is this truly decentralized?

**Answer:** Honestly, it is a **hybrid**:
- **Decentralized:** ALGO payments, contract state, proof hashes, public Indexer verification
- **Centralized:** AI inference, API key management, user authentication, usage database

Full decentralization of AI inference is not practical today. We decentralize the **payment and audit layers** where blockchain adds real value.

---

### Q37: What's your biggest limitation?

**Answer:** AI compute cannot run on-chain. We must trust the backend to forward requests to AI providers and return responses. Proof-of-intelligence mitigates audit concerns but does not replace off-chain compute. Scaling also depends on MongoDB, Redis (optional queues), and AI provider rate limits.

---

### Q38: Comparison to Stripe for API billing?

**Answer:**

| Aspect | Stripe | Sentinel |
|--------|--------|----------|
| Settlement | Custodial fiat | Non-custodial ALGO |
| Chargebacks | Possible | Irreversible on-chain |
| Verification | Stripe dashboard | Public block explorer |
| Micropayments | High fees | ~0.001 ALGO tx fee |
| AI agents | Custom integration | x402-native flow |

---

### Q39: What if Algorand Indexer is slow or down?

**Answer:** We retry Indexer lookups with backoff. AI responses are cached briefly (60s TTL) during payment window. Users can independently verify any transaction on AlgoExplorer or any Algorand indexer — we are not the sole source of truth for payments.

---

### Q40: Future smart contract improvements?

**Answer:**
- On-chain escrow with release upon verified usage
- Creator revenue splits in one atomic group
- ASA-based prepaid credits
- Subscription state on-chain
- Multi-sig admin for Studio treasury

Current contract is a deliberate MVP focused on stats and validated top-ups.

---

### Q41: How do you handle failed AI calls after payment?

**Answer:** The metered flow is designed as quote-first: AI runs before payment in step 1, response is cached, payment unlocks delivery of the already-computed response. This reduces the case where user pays but gets no response. Failed provider calls before payment do not charge the user.

---

### Q42: Explain Puya vs PyTeal vs Reach.

**Answer:** We chose **Puya (algopy)** — modern Python with ARC-4 decorators and type-safe contract patterns. PyTeal is an older Python-to-TEAL library. Reach is a higher-level DSL that compiles to multiple chains. Puya fits our Python contract source and Algorand-native ARC-4 ABI requirements.

---

## 17. One-Minute Elevator Pitch

> **Sentinel** is a pay-per-use AI API marketplace built on Algorand. Users discover AI services from creators, pay **directly in ALGO per API call** — no subscription, no platform cut on marketplace sales. Before delivering AI responses, our backend **verifies every payment on-chain** via the Algorand Indexer. We deployed **`SentinelContract`** on TestNet (App ID **763786783**) to track transparent platform statistics using **atomic payment groups**. We also log **proof-of-intelligence** hashes on-chain for auditability. We wrote the contract in **Python (Puya)**, integrated **Pera Wallet** for users, support a **burner wallet** for agents, and implement **x402** for machine-native payments. Sentinel combines the speed of off-chain AI with the trust properties of on-chain settlement.

---

## 18. Demo Checklist for Judges

Use this checklist before presenting:

- [ ] Backend running and healthy (`GET /api/health`)
- [ ] Contract stats loading (`GET /api/contract/stats?refresh=1`)
- [ ] Smart Contract page shows App ID, address, counters
- [ ] Test purchase demo ready (TestNet ALGO in wallet)
- [ ] One marketplace pay-per-use flow rehearsed (quote → pay → response)
- [ ] AlgoExplorer TestNet link ready for a sample transaction
- [ ] Proof-of-intelligence tx visible in usage history (if configured)
- [ ] `contract/sentinel_contract.py` open for code walkthrough
- [ ] Team roles assigned: who explains contract, who demos payment, who explains AI flow

### Suggested Demo Order (3–5 minutes)

1. **30 sec** — Problem: trust and transparency in AI API billing
2. **60 sec** — Show marketplace: pick service, get quote, pay with Pera, receive AI response
3. **60 sec** — Show Smart Contract page: stats, Test purchase, counters increment
4. **30 sec** — Show AlgoExplorer transaction + proof-of-intelligence note
5. **30 sec** — Mention x402, burner wallet, creator direct payout model

---

## 19. Glossary

| Term | Definition |
|------|------------|
| **ALGO** | Native cryptocurrency of Algorand |
| **MicroAlgo** | Smallest unit; 1 ALGO = 1,000,000 microAlgos |
| **App ID** | Numeric identifier of a deployed Algorand application |
| **Application Address** | Algorand address derived from App ID; can hold ALGO |
| **ARC-4** | Algorand ABI standard for contract method encoding |
| **Atomic Group** | Set of txns that all succeed or all fail together |
| **Algod** | Algorand node API for submission and state reads |
| **Indexer** | Algorand API for searching historical transactions |
| **TEAL** | Algorand smart contract bytecode language |
| **Puya / algopy** | Python framework compiling to TEAL |
| **Pera Wallet** | Popular Algorand wallet with WalletConnect |
| **Burner Wallet** | Hot wallet for automated/agent payments |
| **Proof-of-Intelligence** | On-chain SHA-256 attestation of an AI interaction |
| **x402** | HTTP 402 Payment Required protocol for agent payments |
| **PaymentRef** | UUID in payment note linking txn to cached AI session |
| **MBR** | Minimum Balance Requirement — ALGO locked for on-chain state |

---

## 20. Related Files in This Repository

| Path | Description |
|------|-------------|
| `contract/sentinel_contract.py` | Smart contract source (Python/Puya) |
| `contract/deploy.py` | Python deployment script |
| `contract/contract_info.json` | Deployed App ID and address |
| `docs/CONTRACT_DEPLOYMENT.md` | Deployment runbook |
| `backend/src/services/contractAlgod.js` | Read on-chain global state |
| `backend/src/config/contractConfig.js` | Contract env configuration |
| `backend/src/routes/contract.js` | Stats and activity API |
| `backend/src/routes/wallet.js` | Top-up create/verify |
| `backend/src/services/proofOfIntelligence.js` | Proof hash transactions |
| `backend/src/routes/x402.js` | x402 agent payment flow |
| `backend/src/routes/use.js` | Metered AI call + payment |
| `frontend/src/components/ContractStats.jsx` | Contract stats UI |
| `frontend/src/wallet/pera.js` | Pera Wallet integration |
| `DOCUMENTATION.md` | Full project technical documentation |
| `LLM_PROJECT_CONTEXT.md` | Condensed project context |

---

*Last updated: June 2026 — SentinelAI / Zenith Team*
