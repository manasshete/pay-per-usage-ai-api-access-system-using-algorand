# @sentinel-ai/sdk

> Official JavaScript/TypeScript SDK for the [Sentinel](https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand) pay-per-use AI API marketplace powered by Algorand.

[![npm version](https://img.shields.io/npm/v/@sentinel-ai/sdk.svg)](https://www.npmjs.com/package/@sentinel-ai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is Sentinel?

Sentinel is a pay-per-use AI API marketplace where every call is backed by a real **Algorand micro-payment**. No subscriptions, no lock-in — you pay only for what you use, and the on-chain receipt proves it.

This SDK handles the entire **invoke → pay → complete** flow:
1. Send a prompt → AI runs → receive a payment quote
2. SDK signs and submits an Algorand payment transaction
3. Payment verified on-chain → AI response unlocked

---

## Install

```bash
npm install @sentinel-ai/sdk algosdk
```

---

## Quick Start (Node.js)

```ts
import { MnemonicSigner, SentinelClient } from "@sentinel-ai/sdk";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!, // sk-sentinel-...
  baseUrl: "http://localhost:5000",
  network: "testnet",
});

// Server-side only — never use MnemonicSigner in browsers
const signer = new MnemonicSigner(process.env.SENTINEL_MNEMONIC!);

const response = await client.chat(
  [{ role: "user", content: "Explain Algorand in one sentence." }],
  signer
);

console.log(SentinelClient.getAssistantText(response));
// → "Algorand is a pure proof-of-stake blockchain..."

console.log(response.sentinelReceipt);
// → { paymentTxId: "ABCD...", chargeAlgo: 0.001, totalTokens: 38 }
```

---

## Browser + Pera Wallet

```ts
import { PeraWalletConnect } from "@perawallet/connect";
import { BYOSigner, SentinelClient } from "@sentinel-ai/sdk";

const pera = new PeraWalletConnect();
const [address] = await pera.connect();

const client = new SentinelClient({
  apiKey: "sk-sentinel-...",
  baseUrl: "https://your-sentinel-api.example",
  network: "testnet",
});

const signer = new BYOSigner(address, async (txn) => {
  const signed = await pera.signTransaction([[{ txn }]]);
  return signed[0]; // Uint8Array
});

const response = await client.chat(
  [{ role: "user", content: "Hello from the browser!" }],
  signer
);

console.log(SentinelClient.getAssistantText(response));
```

---

## Two-Phase Flow (Manual)

Use `invoke()` and `complete()` directly when you need more control:

```ts
// Step 1: get quote
const quote = await client.invoke([{ role: "user", content: "Hello!" }]);
console.log(`Pay ${quote.chargeAlgo} ALGO to ${quote.developerWallet}`);

// Step 2: build, sign, submit payment manually
const txn = await buildPaymentTx({
  from: signer.address,
  to: quote.developerWallet,
  microAlgos: quote.expectedMicroAlgos,
  paymentRef: quote.paymentRef,   // ← must go in txn note field
  algodClient: client.algodClient,
});
const signed = await signer.sign(txn);
const txId = await submitSignedPayment({ signedTxn: signed, algodClient: client.algodClient });

// Step 3: claim AI response
const response = await client.complete(quote.paymentRef, txId);
```

---

## Signers

| Class | Use case |
|-------|---------|
| `MnemonicSigner` | Server/scripts — signs with a 25-word mnemonic |
| `BYOSigner` | Browser — plug in Pera Wallet, Defly, or any wallet |
| `PreSignedSigner` | Advanced — provide pre-signed transaction bytes |

---

## Error Handling

```ts
import {
  SentinelAuthError,
  SentinelSessionExpired,
  SentinelUpstreamError,
} from "@sentinel-ai/sdk";

try {
  const response = await client.chat(messages, signer);
} catch (err) {
  if (err instanceof SentinelAuthError) {
    // Invalid API key — regenerate from marketplace
  } else if (err instanceof SentinelSessionExpired) {
    // paymentRef TTL expired (>60s) — retry the call
  } else if (err instanceof SentinelUpstreamError) {
    // AI provider temporarily unavailable
  }
}
```

| Error class | HTTP | Cause |
|-------------|------|-------|
| `SentinelAuthError` | 401 | Bad/missing API key |
| `SentinelPaymentError` | 402 | Payment not verified |
| `SentinelSessionExpired` | 410 | Quote expired (>60s) |
| `SentinelUpstreamError` | 502 | AI provider failed |
| `SentinelNetworkError` | — | Fetch/timeout failure |

---

## TypeScript Support

Full TypeScript support with exported types:

```ts
import type {
  ChatMessage,
  ChatOptions,
  CompleteResponse,
  InvokeResponse,
  SentinelClientOptions,
  SentinelReceipt,
  ServicePublicInfo,
} from "@sentinel-ai/sdk";
```

---

## Environment Support

| Environment | Status |
|-------------|--------|
| Node.js ≥ 18 | ✅ |
| Modern browsers (ESM) | ✅ |
| Next.js (App Router) | ✅ Server components |
| React Native | ⚠️ Requires polyfills |

---

## Docs

| Document | Contents |
|----------|---------|
| [Quickstart](./docs/quickstart.md) | Get your first call working in 5 minutes |
| [API Reference](./docs/api-reference.md) | Full `SentinelClient` API reference |
| [Examples](./docs/examples.md) | Node.js, React, Next.js, manual flow |
| [Error Handling](./docs/error-handling.md) | Typed errors with retry patterns |
| [Wallet Guides](./docs/algorand-wallets.md) | Pera, Defly, MnemonicSigner, raw algosdk |

---

## Streaming

Deferred to **v1.1**. `opts.stream` is accepted but ignored in v1.0.

---

## Contributing

SDK source lives in `sdk/` at the root of the [Sentinel monorepo](https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand).

```bash
cd sdk
npm install
npm run build
npm test
```

---

## License

MIT — Copyright © 2025 Sentinel AI Team
