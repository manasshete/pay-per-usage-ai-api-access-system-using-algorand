/**
 * Browser + Pera Wallet example (pseudo-code — wire to your app's Pera connect flow).
 *
 * import { PeraWalletConnect } from "@perawallet/connect";
 * import { BYOSigner, SentinelClient } from "@sentinel-ai/sdk";
 *
 * const pera = new PeraWalletConnect();
 * const accounts = await pera.connect();
 * const address = accounts[0];
 *
 * const client = new SentinelClient({
 *   apiKey: "sk-sentinel-...",
 *   baseUrl: "https://your-sentinel-api.example",
 * });
 *
 * const signer = new BYOSigner(address, async (txn) => {
 *   const signed = await pera.signTransaction([[{ txn }]]);
 *   return signed[0];
 * });
 *
 * const response = await client.chat(
 *   [{ role: "user", content: "Explain Algorand micro-payments briefly." }],
 *   signer
 * );
 *
 * console.log(SentinelClient.getAssistantText(response));
 */
export {};
