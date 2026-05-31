# Examples — @sentinalapi/sdk

---

## Node.js (Server-side, MnemonicSigner)

Full example using environment variables:

```ts
// Run with: SENTINEL_API_KEY=sk-sentinel-... SENTINEL_MNEMONIC="word1 ..." npx tsx example.ts

import { MnemonicSigner, SentinelClient, SentinelError } from "@sentinalapi/sdk";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!,
  baseUrl: process.env.SENTINEL_BASE_URL ?? "http://localhost:5000",
  network: "testnet",
});

const signer = new MnemonicSigner(process.env.SENTINEL_MNEMONIC!);

try {
  const response = await client.chat(
    [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is Algorand?" },
    ],
    signer,
    { temperature: 0.7, maxTokens: 200 }
  );

  console.log("Answer:", SentinelClient.getAssistantText(response));
  console.log("Paid:", response.sentinelReceipt.chargeAlgo, "ALGO");
  console.log("Tokens:", response.sentinelReceipt.totalTokens);
  console.log("Tx:", response.sentinelReceipt.paymentTxId);
} catch (err) {
  if (err instanceof SentinelError) {
    console.error(`[${err.name}] ${err.message}`);
  } else {
    throw err;
  }
}
```

---

## Browser + Pera Wallet (React)

```tsx
import React, { useState } from "react";
import { PeraWalletConnect } from "@perawallet/connect";
import { BYOSigner, SentinelClient, SentinelClient as SC } from "@sentinalapi/sdk";

const pera = new PeraWalletConnect();

const client = new SentinelClient({
  apiKey: import.meta.env.VITE_SENTINEL_API_KEY,
  baseUrl: import.meta.env.VITE_SENTINEL_BASE_URL,
  network: "testnet",
});

export function AiChat() {
  const [address, setAddress] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    const accounts = await pera.connect();
    setAddress(accounts[0]);
  }

  async function askQuestion() {
    if (!address) return;
    setLoading(true);

    const signer = new BYOSigner(address, async (txn) => {
      const signed = await pera.signTransaction([[{ txn }]]);
      return signed[0];
    });

    const response = await client.chat(
      [{ role: "user", content: "Explain blockchain in one sentence." }],
      signer
    );

    setAnswer(SC.getAssistantText(response));
    setLoading(false);
  }

  return (
    <div>
      {!address ? (
        <button onClick={connectWallet}>Connect Pera Wallet</button>
      ) : (
        <button onClick={askQuestion} disabled={loading}>
          {loading ? "Signing & calling AI..." : "Ask AI"}
        </button>
      )}
      {answer && <p>{answer}</p>}
    </div>
  );
}
```

---

## Manual Two-Phase Flow (Advanced)

For scenarios where you want to show the user the cost before signing:

```ts
import {
  buildPaymentTx,
  submitSignedPayment,
  MnemonicSigner,
  SentinelClient,
} from "@sentinalapi/sdk";

const client = new SentinelClient({ apiKey: "sk-sentinel-...", network: "testnet" });
const signer = new MnemonicSigner(process.env.SENTINEL_MNEMONIC!);

// Step 1: Get a quote
const quote = await client.invoke([{ role: "user", content: "Hello!" }]);
console.log(`Cost: ${quote.chargeAlgo} ALGO (${quote.totalTokens} tokens)`);

// Step 2: Build & sign payment
const txn = await buildPaymentTx({
  from: signer.address,
  to: quote.developerWallet,
  microAlgos: quote.expectedMicroAlgos,
  paymentRef: quote.paymentRef,
  algodClient: client.algodClient,
});
const signed = await signer.sign(txn);

// Step 3: Submit to Algorand network
const txId = await submitSignedPayment({ signedTxn: signed, algodClient: client.algodClient });
console.log("Payment tx:", txId);

// Step 4: Unlock AI response
const response = await client.complete(quote.paymentRef, txId);
console.log(SentinelClient.getAssistantText(response));
```

---

## Next.js App Router (Server Component)

```ts
// app/ask/route.ts
import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";
import { NextResponse } from "next/server";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!,
  baseUrl: process.env.SENTINEL_BASE_URL!,
  network: "testnet",
});

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const signer = new MnemonicSigner(process.env.ALGORAND_MNEMONIC!);
  const response = await client.chat([{ role: "user", content: prompt }], signer);
  return NextResponse.json({
    answer: SentinelClient.getAssistantText(response),
    receipt: response.sentinelReceipt,
  });
}
```
