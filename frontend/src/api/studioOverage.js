import { api } from "./client.js";
import { reconnectPera, normalizeAccountAddress } from "../wallet/pera.js";
import { PeraWalletConnect } from "@perawallet/connect";

const peraWallet = new PeraWalletConnect({ chainId: 416002 });

let cachedReceiverWallet = "";

export function setCachedReceiverWallet(address) {
  cachedReceiverWallet = String(address || "").trim();
}

export function getOveragePayTo() {
  return (
    import.meta.env.VITE_SENTINEL_WALLET_ADDRESS?.trim() ||
    import.meta.env.VITE_RECEIVER_WALLET?.trim() ||
    cachedReceiverWallet ||
    ""
  );
}

/** Resolve pay-to address from env or backend public config. */
export async function resolveOveragePayTo() {
  const fromEnv = getOveragePayTo();
  if (fromEnv) return fromEnv;

  const { data } = await api.get("/api/public/network");
  const wallet = data?.receiverWallet?.trim() || "";
  if (wallet) setCachedReceiverWallet(wallet);
  return wallet;
}

/**
 * Sign, submit, and build x402 X-Payment header for Studio overage.
 * @returns {Promise<string>} base64-encoded ExactAvmPayload
 */
export async function buildX402PaymentHeader({ from, to, amountMicroAlgos, algodServer }) {
  const algosdk = (await import("algosdk")).default;
  const signer = normalizeAccountAddress(from);
  const toAddr = normalizeAccountAddress(to);
  const amt = Math.round(Number(amountMicroAlgos));

  if (!peraWallet.isConnected) {
    await reconnectPera();
  }
  if (!peraWallet.isConnected) {
    throw new Error("Connect Pera Wallet to pay Studio overage.");
  }

  const algod = new algosdk.Algodv2("", algodServer.trim(), "");
  const suggestedParams = await algod.getTransactionParams().do();
  const note = new TextEncoder().encode("Sentinel Studio overage");

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer,
    receiver: toAddr,
    amount: amt,
    note,
    suggestedParams,
  });

  const signedTxns = await peraWallet.signTransaction([[{ txn }]]);
  const signedBytes = signedTxns[0];
  const signedB64 = Buffer.from(signedBytes).toString("base64");

  const submitted = await algod.sendRawTransaction(signedBytes).do();
  const txId = submitted?.txid ?? submitted?.txId;
  if (!txId) throw new Error("Payment submit failed");

  await algosdk.waitForConfirmation(algod, txId, 4);

  const payload = { paymentGroup: [signedB64], paymentIndex: 0 };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
