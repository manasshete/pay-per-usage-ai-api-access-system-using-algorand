# SentinelAI: Client Integration Guide

This guide details how to integrate Sentinel's pay-per-use AI services into external applications. Depending on your needs, you can choose from three methods:

1. **Method 1: Pre-Funded Gateway v2 Proxy** — Easiest integration, compatible with standard OpenAI SDK.
2. **Method 2: Pay-Per-Call via SDK** — Direct on-chain payments per API call.
3. **Method 3: Keyless x402 Protocol** — Pure Web3, no API keys, pay-with-wallet authentication.

---

## 🛠️ Method 1: Pre-Funded Gateway v2 (Easiest)

If your app uses the standard OpenAI client libraries, you can integrate Sentinel as a drop-in replacement. Pre-fund your account on the Sentinel **Gateway Wallet** page and use your Sentinel API key.

### Node.js (OpenAI SDK Client)

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  // Point to the Sentinel Gateway proxy URL
  baseURL: "https://api.sentinalai.com/proxy/llama-3-3", // Replace llama-3-3 with your API slug
  apiKey: "sk-sentinel-8ba99e60b1fbc...", // Your Sentinel API Key
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: "Explain blockchain in one sentence." }],
    model: "llama-3.3-70b-versatile",
  });

  console.log(completion.choices[0].message.content);
}

main();
```

### Python (OpenAI SDK Client)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.sentinalai.com/proxy/llama-3-3",
    api_key="sk-sentinel-8ba99e60b1fbc..."
)

completion = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Explain blockchain in one sentence."}]
)

print(completion.choices[0].message.content)
```

---

## ⛓️ Method 2: Pay-Per-Call via `@sentinalapi/sdk`

For automated, direct on-chain Algorand micro-payments for every individual call without pre-funding a gateway balance.

### 1. Installation

```bash
npm install @sentinalapi/sdk algosdk
```

### 2. Node.js Integration (Server-Side)

```typescript
import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";

const client = new SentinelClient({
  apiKey: "sk-sentinel-8ba99e60b1fbc...", // Your Sentinel API Key
  baseUrl: "https://api.sentinalai.com",
  network: "testnet", // 'testnet' or 'mainnet'
});

// Create a signer using a 25-word Algorand recovery phrase
// Note: Keep mnemonic in environment variables and never expose it in browser code.
const signer = new MnemonicSigner("your 25 word recovery phrase...");

async function run() {
  try {
    const response = await client.chat(
      [{ role: "user", content: "Tell me a short joke." }],
      signer
    );

    console.log("AI Response:", SentinelClient.getAssistantText(response));
    console.log("On-Chain Receipt:", response.sentinelReceipt);
    // { paymentTxId: 'ABCD...', chargeAlgo: 0.001, totalTokens: 35 }
  } catch (err) {
    console.error("API Call Failed:", err.message);
  }
}

run();
```

### 3. Browser Integration (Frontend / Pera Wallet)

```typescript
import { PeraWalletConnect } from "@perawallet/connect";
import { BYOSigner, SentinelClient } from "@sentinalapi/sdk";

const pera = new PeraWalletConnect();
const [address] = await pera.connect();

const client = new SentinelClient({
  apiKey: "sk-sentinel-...",
  baseUrl: "https://api.sentinalai.com",
  network: "testnet",
});

// Configure signer to request signatures from Pera Wallet popup
const signer = new BYOSigner(address, async (txn) => {
  const signed = await pera.signTransaction([[{ txn }]]);
  return signed[0]; // Returns Uint8Array
});

const response = await client.chat(
  [{ role: "user", content: "Hello from the browser!" }],
  signer
);

console.log(SentinelClient.getAssistantText(response));
```

---

## 🔑 Method 3: Keyless x402 direct payment (Pure Web3)

The **x402 Protocol** uses payments as credentials. Callers do not require API keys or pre-funded accounts. They pay for each request directly from a wallet on-chain.

### Browser/Node integration using `@x402/fetch`

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { toClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

// 1. Recover your burner wallet
const account = algosdk.mnemonicToSecretKey("your burner mnemonic...");
const signer = toClientAvmSigner(account.sk);

// 2. Wrap the global fetch function
const fetchWithPay = wrapFetchWithPayment(fetch, signer);

// 3. Request AI Completion (Automatically handles the 402 challenge loop)
const res = await fetchWithPay("https://api.sentinalai.com/api/x402/use/69d09731666294ae30b63002", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "What is 2+2?" }]
  })
});

const data = await res.json();
console.log("Response:", data.choices[0].message.content);
console.log("Receipt:", data.sentinelReceipt);
```
