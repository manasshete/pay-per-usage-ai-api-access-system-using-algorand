# Quickstart — @sentinalapi/sdk

Get from zero to a working Sentinel AI API call in under 5 minutes.

## 1. Install

```bash
npm install @sentinalapi/sdk algosdk
```

## 2. Get an API Key

1. Sign in to the Sentinel marketplace with your Pera Wallet.
2. Browse the **API Marketplace** and find a service you want to use.
3. Click **Get Access Key** on that service page — the key is generated instantly.
4. Copy the key (format: `sk-sentinel-...`).

## 3. Fund your Algorand wallet

Top-up a TestNet wallet at [bank.testnet.algorand.network](https://bank.testnet.algorand.network/).

## 4. Write your first call (Node.js)

```ts
import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!,
  baseUrl: "http://localhost:5000", // or your deployed Sentinel API URL
  network: "testnet",
});

// MnemonicSigner is for server/script use only — never expose in browser code
const signer = new MnemonicSigner(process.env.SENTINEL_MNEMONIC!);

const response = await client.chat(
  [{ role: "user", content: "Explain Algorand micro-payments in one sentence." }],
  signer
);

console.log(SentinelClient.getAssistantText(response));
// → "Algorand micro-payments allow users to pay tiny amounts of ALGO..."

console.log(response.sentinelReceipt);
// → { paymentTxId: "ABC...", chargeAlgo: 0.001, totalTokens: 42, ... }
```

## 5. What happens under the hood?

`client.chat()` runs three steps automatically:

| Step | What happens |
|------|-------------|
| **1. invoke** | Sends your prompt → AI runs → returns `paymentRef` + `chargeAlgo` |
| **2. pay** | Signs an Algorand payment txn to the service developer's wallet |
| **3. complete** | Submits `txId` + `paymentRef` → server verifies on-chain → returns AI response |

You can also run steps manually for more control. See [API Reference](./api-reference.md).

## Next steps

- [API Reference](./api-reference.md) — full `SentinelClient` docs
- [Examples](./examples.md) — Node.js, Browser + Pera Wallet, Next.js
- [Error Handling](./error-handling.md) — typed errors
- [Wallet Guides](./algorand-wallets.md) — Pera, Defly, MnemonicSigner
