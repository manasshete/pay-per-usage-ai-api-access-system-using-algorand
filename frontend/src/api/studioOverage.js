import { api } from "./client.js";
import { buildX402PaymentHeader as buildHeader } from "../wallet/signPayment.js";

let cachedReceiverWallet = "";

export function setCachedReceiverWallet(address) {
  cachedReceiverWallet = String(address || "").trim();
}

export function getOveragePayTo() {
  return (
    import.meta.env.VITE_RECEIVER_WALLET?.trim() ||
    import.meta.env.VITE_SENTINEL_WALLET_ADDRESS?.trim() ||
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
 * Uses the active use-wallet provider (Pera, Defly, Exodus, Kibisis, Lute).
 * @returns {Promise<string>} base64-encoded ExactAvmPayload
 */
export async function buildX402PaymentHeader({ from, to, amountMicroAlgos, algodServer }) {
  return buildHeader({
    from,
    to,
    amountMicroAlgos,
    noteStr: "Sentinel Studio overage",
    algodServer,
  });
}
