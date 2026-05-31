# API Reference — @sentinalapi/sdk

## `SentinelClient`

The main class for interacting with the Sentinel API.

### Constructor

```ts
new SentinelClient(options: SentinelClientOptions)
```

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | ✅ | — | `sk-sentinel-...` key from the marketplace |
| `baseUrl` | `string` | | `http://localhost:5000` | Base URL of your Sentinel backend |
| `network` | `"testnet" \| "mainnet"` | | `"testnet"` | Algorand network for payment submission |
| `algodServer` | `string` | | Auto (AlgoNode) | Custom algod server URL |
| `algodToken` | `string` | | `""` | Algod API token (empty for public nodes) |
| `timeout` | `number` | | `120000` | Request timeout in milliseconds |

---

### `client.chat(messages, signer, opts?)`

**High-level one-shot call.** Runs invoke → sign → submit → complete automatically.

```ts
async chat(
  messages: ChatMessage[],
  signer: Signer,
  opts?: ChatOptions
): Promise<CompleteResponse>
```

**Parameters:**
- `messages` — Array of `{ role: "user" | "assistant" | "system", content: string }`
- `signer` — A `MnemonicSigner`, `BYOSigner`, or `PreSignedSigner` instance
- `opts.model` — Override model name
- `opts.temperature` — Model temperature (0–2)
- `opts.maxTokens` — Max completion tokens
- `opts.prompt` — Shorthand: pass a string instead of `messages` array

**Returns:** `CompleteResponse` (OpenAI-compatible + `sentinelReceipt`)

---

### `client.invoke(messages, opts?)`

**Phase 1:** Run the AI model and receive a payment quote.

```ts
async invoke(messages: ChatMessage[], opts?: ChatOptions): Promise<InvokeResponse>
```

**Returns:**
```ts
{
  awaitingPayment: true,
  paymentRef: string,        // UUID — include in Algorand txn note
  chargeAlgo: number,        // ALGO amount to pay (human-readable)
  expectedMicroAlgos: number, // exact microAlgo amount for the txn
  totalTokens: number,
  promptTokens: number,
  completionTokens: number,
  pricePerThousandTokens: number,
  minimumChargeAlgo: number,
  developerWallet: string,   // Algorand address to send payment to
}
```

---

### `client.complete(paymentRef, txId)`

**Phase 2:** Submit the on-chain transaction ID and receive the AI response.

```ts
async complete(paymentRef: string, txId: string): Promise<CompleteResponse>
```

**Returns:** Full OpenAI-compatible response + `sentinelReceipt`.

---

### `client.getServicePublicInfo(serviceId)`

Fetch public info about a service (no API key needed).

```ts
async getServicePublicInfo(serviceId: string): Promise<ServicePublicInfo>
```

---

### `SentinelClient.getAssistantText(response)`

Static helper to extract the assistant's text content from a `CompleteResponse`.

```ts
static getAssistantText(response: CompleteResponse): string
```

---

## Signers

### `MnemonicSigner`

Signs with a raw Algorand mnemonic. **Server/script use only.**

```ts
const signer = new MnemonicSigner("word1 word2 ... word25");
signer.address; // Algorand address derived from mnemonic
```

### `BYOSigner`

Bring-your-own signing function — plug in Pera Wallet, Defly, or any other wallet.

```ts
const signer = new BYOSigner(
  walletAddress,
  async (txn) => {
    // Your wallet signs the txn and returns Uint8Array
    const signed = await peraWallet.signTransaction([[{ txn }]]);
    return signed[0];
  }
);
```

### `PreSignedSigner`

Use when you already have signed transaction bytes.

```ts
const signer = new PreSignedSigner(address, signedTxnBytes);
```

---

## Algorand Utilities

```ts
import { buildPaymentTx, submitSignedPayment, createAlgodClient } from "@sentinalapi/sdk";

// Create algod client
const algod = createAlgodClient("testnet");

// Build unsigned payment transaction
const txn = await buildPaymentTx({
  from: "ABC...",
  to: "XYZ...",          // developerWallet from invoke response
  microAlgos: 1000,      // expectedMicroAlgos from invoke response
  paymentRef: "uuid...", // paymentRef from invoke response
  algodClient: algod,
});

// Submit signed transaction and wait for confirmation
const txId = await submitSignedPayment({ signedTxn, algodClient: algod });
```

---

## Types

```ts
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface SentinelReceipt {
  paymentTxId: string;
  chargeAlgo: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  pricePerThousandTokens: number;
}

interface CompleteResponse {
  choices?: Array<{ message?: { role?: string; content?: string } }>;
  sentinelReceipt: SentinelReceipt;
  // + standard OpenAI fields: id, model, usage, etc.
}
```
