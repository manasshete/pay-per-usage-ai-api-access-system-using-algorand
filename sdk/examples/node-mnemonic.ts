/**
 * Node.js example — server-side mnemonic signing (NEVER use in browser).
 *
 * Usage:
 *   SENTINEL_API_KEY=sk-sentinel-... \
 *   SENTINEL_MNEMONIC="25 word phrase ..." \
 *   npx tsx examples/node-mnemonic.ts
 */
import { MnemonicSigner, SentinelClient } from "../src/index.js";

async function main() {
  const apiKey = process.env.SENTINEL_API_KEY;
  const mnemonic = process.env.SENTINEL_MNEMONIC;
  const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:5000";

  if (!apiKey || !mnemonic) {
    console.error("Set SENTINEL_API_KEY and SENTINEL_MNEMONIC");
    process.exit(1);
  }

  const client = new SentinelClient({ apiKey, baseUrl, network: "testnet" });
  const signer = new MnemonicSigner(mnemonic);

  const response = await client.chat(
    [{ role: "user", content: "Say hello in one sentence." }],
    signer
  );

  console.log(SentinelClient.getAssistantText(response));
  console.log("Receipt:", response.sentinelReceipt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
