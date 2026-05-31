import algosdk from "algosdk";

let indexerClient;

function getIndexerServer() {
  const raw =
    process.env.ALGO_INDEXER_URL ||
    process.env.INDEXER_SERVER ||
    process.env.ALGORAND_INDEXER ||
    "https://testnet-idx.algonode.cloud";
  return String(raw).trim().replace(/\/$/, "");
}

function getIndexer() {
  if (!indexerClient) {
    indexerClient = new algosdk.Indexer("", getIndexerServer(), "");
  }
  return indexerClient;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Same idea as ppu-ai walletController: indexerClient.lookupTransactionByID(txId).do()
 * with retries while the tx propagates to the indexer (avoids immediate verify failures).
 */
export async function lookupTransactionByIDWithRetry(
  txId,
  { tries = 12, delayMs = 1500 } = {}
) {
  const client = getIndexer();
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await client.lookupTransactionByID(txId).do();
    } catch (e) {
      lastErr = e;
      if (!isIndexerNotFound(e)) throw e;
      if (i < tries - 1) await sleep(delayMs);
    }
  }
  throw new Error(
    "Transaction not visible on the Algorand indexer yet. " +
    "The network may be lagging — wait a moment and try submitting your txId again."
  );
}

/**
 * Defensive parsing like ppu-ai walletController (tx-type / snd / rcv / amt).
 */
export function parsePaymentFromIndexer(txInfo) {
  const tx = txInfo?.transaction ?? txInfo;
  if (!tx) return null;
  const txType = tx["tx-type"] ?? tx.txType;
  if (txType !== "pay") return null;
  const payment = tx["payment-transaction"] ?? tx.paymentTransaction;
  if (!payment) return null;
  const sender = tx.sender ?? tx.snd;
  const receiver = payment.receiver ?? payment.rcv;
  const amount = Number(payment.amount ?? payment.amt ?? 0);
  const note = tx.note;
  return { sender, receiver, amount, note };
}

export function normalizeAlgoAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  try {
    return algosdk.encodeAddress(algosdk.decodeAddress(addr.trim()));
  } catch {
    return addr.trim();
  }
}

export function algoToMicroAlgos(algo) {
  return Math.round(Number(algo) * 1e6);
}

export function decodeNote(noteField) {
  if (!noteField) return "";
  if (noteField instanceof Uint8Array || Buffer.isBuffer(noteField)) {
    try {
      return Buffer.from(noteField).toString("utf8");
    } catch {
      return "";
    }
  }
  try {
    const buf = Buffer.from(noteField, "base64");
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

/** Indexer transaction payload includes confirmed-round when finalized. */
export function indexerTransactionConfirmedRound(txInfo) {
  const tx = txInfo?.transaction;
  const r =
    tx?.confirmedRound ??
    tx?.["confirmed-round"] ??
    txInfo?.["confirmed-round"] ??
    txInfo?.confirmedRound;
  if (r === undefined || r === null) return null;
  const n = typeof r === "bigint" ? Number(r) : Number(r);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Returns true when an algosdk Indexer error is a 404 "Not Found".
 * algosdk v3 surfaces the algonode JSON body as the error message:
 *   {"message":"Not Found","requestID":"..."}  ← exactly what we intercept here.
 */
export function isIndexerNotFound(e) {
  if (!e) return false;
  // HTTP status codes surfaced by algosdk
  if (e?.status === 404 || e?.response?.status === 404) return true;
  const raw = String(e?.message || e || "");
  // algonode v3 JSON body format
  try {
    const parsed = JSON.parse(raw);
    const msg = String(parsed?.message || "").toLowerCase();
    if (msg === "not found" || msg.includes("not found")) return true;
  } catch { /* not JSON */ }
  // plain text fallbacks
  const lower = raw.toLowerCase();
  return lower.includes("not found") || lower.includes("404");
}

/**
 * Polls the indexer until the transaction appears with confirmed-round > 0,
 * or exhausts attempts (handles TestNet indexer lag after broadcast).
 */
export async function lookupConfirmedTransactionOnIndexer(
  txId,
  { maxAttempts = 10, delayMs = 2000 } = {}
) {
  const id = typeof txId === "string" ? txId.trim() : String(txId || "").trim();
  if (!id) {
    throw new Error("Missing transaction id");
  }
  const client = getIndexer();
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const info = await client.lookupTransactionByID(id).do();
      if (indexerTransactionConfirmedRound(info)) {
        return info;
      }
      // Transaction seen but not confirmed yet
      console.log(
        `[indexer] attempt ${attempts}/${maxAttempts} tx ${id}: no confirmed-round yet`
      );
    } catch (e) {
      if (!isIndexerNotFound(e)) {
        // Unexpected error — rethrow immediately (don't waste retries)
        throw e;
      }
      console.log(
        `[indexer] attempt ${attempts}/${maxAttempts} tx ${id}: not found yet (indexer lag)`
      );
    }
    if (attempts < maxAttempts) {
      await sleep(delayMs);
    }
  }
  throw new Error(
    "Payment not visible on the Algorand indexer after multiple attempts. " +
    "The TestNet indexer can lag 20–30s behind the node. " +
    "Wait a moment and resubmit your transaction ID."
  );
}

/** Native ALGO balance (microalgos) for an account from the indexer. */
export async function fetchAccountBalanceMicroAlgos(address) {
  const client = getIndexer();
  const norm = normalizeAlgoAddress(address);
  const data = await client.lookupAccountByID(norm).do();
  const amt = data?.account?.amount ?? data?.amount;
  return Number(amt) || 0;
}
