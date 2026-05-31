# Algorand Wallet Guides — @sentinalapi/sdk

The SDK abstracts wallet signing via the `Signer` interface. Here's how to plug in each wallet.

---

## Pera Wallet (Browser)

Install the Pera Wallet connector:

```bash
npm install @perawallet/connect
```

```ts
import { PeraWalletConnect } from "@perawallet/connect";
import { BYOSigner, SentinelClient } from "@sentinalapi/sdk";

const pera = new PeraWalletConnect();
const accounts = await pera.connect();
const address = accounts[0];

const client = new SentinelClient({
  apiKey: "sk-sentinel-...",
  baseUrl: "https://your-sentinel-api.example",
  network: "testnet",
});

const signer = new BYOSigner(address, async (txn) => {
  // Pera expects an array of transaction groups
  const signed = await pera.signTransaction([[{ txn }]]);
  return signed[0]; // Uint8Array
});

const response = await client.chat(
  [{ role: "user", content: "Hello!" }],
  signer
);
console.log(SentinelClient.getAssistantText(response));
```

---

## Defly Wallet (Browser)

```ts
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import { BYOSigner, SentinelClient } from "@sentinalapi/sdk";

const defly = new DeflyWalletConnect();
const accounts = await defly.connect();

const signer = new BYOSigner(accounts[0], async (txn) => {
  const signed = await defly.signTransaction([[{ txn }]]);
  return signed[0];
});
```

---

## MnemonicSigner (Server / Scripts Only)

> ⚠️ **Never use in browser code.** Mnemonic is exposed in plaintext.

```ts
import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";

const signer = new MnemonicSigner(process.env.ALGORAND_MNEMONIC!);
// signer.address → the Algorand address derived from the mnemonic

const response = await client.chat(messages, signer);
```

Store your mnemonic in environment variables or a secrets manager, never in source code.

---

## Raw algosdk (Custom Signing)

If you manage keys manually:

```ts
import algosdk from "algosdk";
import { BYOSigner, SentinelClient } from "@sentinalapi/sdk";

const account = algosdk.mnemonicToSecretKey(mnemonic);

const signer = new BYOSigner(account.addr, async (txn) => {
  return txn.signTxn(account.sk);
});
```

---

## PreSignedSigner (Advanced)

Use when you sign the transaction externally (e.g., in a hardware wallet or secure enclave) and only have the signed bytes:

```ts
import { PreSignedSigner } from "@sentinalapi/sdk";

// Build txn manually, sign it externally, then:
const signer = new PreSignedSigner(address, signedTxnBytes);
// call client.chat(messages, signer) — signer.sign() returns the pre-signed bytes
```

---

## Network Configuration

The SDK defaults to **TestNet**. To use MainNet:

```ts
const client = new SentinelClient({
  apiKey: "sk-sentinel-...",
  baseUrl: "https://your-mainnet-api.example",
  network: "mainnet",
  // Optionally use your own algod node:
  algodServer: "https://mainnet-api.algonode.cloud",
  algodToken: "",
});
```

Public free algod endpoints:
- **TestNet:** `https://testnet-api.algonode.cloud`
- **MainNet:** `https://mainnet-api.algonode.cloud`
