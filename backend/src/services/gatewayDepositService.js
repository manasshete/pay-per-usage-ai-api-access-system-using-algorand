import algosdk from "algosdk";
import { User } from "../models/User.js";
import { GatewayDeposit } from "../models/GatewayDeposit.js";
import { creditBalanceCents } from "./gatewayBalanceService.js";
import { persistLedgerTransaction } from "./gatewayPersistence.js";
import {
  lookupTransactionByIDWithRetry,
  parsePaymentFromIndexer,
  decodeNote,
  normalizeAlgoAddress,
} from "./algorandService.js";

function vaultAddress() {
  return (
    process.env.GATEWAY_VAULT_ADDRESS?.trim() ||
    process.env.RECEIVER_WALLET?.trim() ||
    process.env.TREASURY_WALLET?.trim() ||
    ""
  );
}

function microAlgosToCents(micro) {
  const algo = Number(micro) / 1e6;
  const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
  return Math.max(1, Math.round(algo * rate));
}

function parseDepositNote(noteStr) {
  const n = String(noteStr || "").trim();
  const m = n.match(/^sentinel-deposit:([a-f0-9]{24})$/i);
  if (m) return m[1];
  return null;
}

export function getDepositInstructions(userId) {
  const vault = vaultAddress();
  if (!vault || !algosdk.isValidAddress(vault)) {
    throw new Error("Gateway vault address not configured (RECEIVER_WALLET)");
  }
  return {
    vaultAddress: vault,
    network: "algorand-testnet",
    note: `sentinel-deposit:${userId}`,
    minMicroAlgos: 100000,
    pollIntervalSeconds: 30,
  };
}

export async function confirmDepositByTxId({ userId, txId }) {
  const vault = normalizeAlgoAddress(vaultAddress());
  const existing = await GatewayDeposit.findOne({ txId }).lean();
  if (existing?.status === "confirmed") {
    return { ok: true, already: true, amountCents: existing.amountCents };
  }

  const txInfo = await lookupTransactionByIDWithRetry(txId, { tries: 8, delayMs: 2000 });
  const parsed = parsePaymentFromIndexer(txInfo);
  if (!parsed) {
    throw new Error("Transaction is not a payment");
  }

  const receiver = normalizeAlgoAddress(parsed.receiver);
  if (receiver !== vault) {
    throw new Error("Payment was not sent to the Sentinel vault");
  }

  const noteUserId = parseDepositNote(decodeNote(parsed.note));
  if (noteUserId && String(noteUserId) !== String(userId)) {
    throw new Error("Deposit note does not match your account");
  }

  const amountCents = microAlgosToCents(parsed.amount);
  const confirmedRound = txInfo?.confirmed-round ?? txInfo?.["confirmed-round"];

  let deposit = existing;
  if (!deposit) {
    deposit = await GatewayDeposit.create({
      userId,
      txId,
      amountMicroAlgos: parsed.amount,
      amountCents,
      senderAddress: normalizeAlgoAddress(parsed.sender),
      status: "confirmed",
      confirmedRound: Number(confirmedRound) || undefined,
    });
  } else {
    deposit.status = "confirmed";
    deposit.amountCents = amountCents;
    await deposit.save();
  }

  const balanceAfter = await creditBalanceCents(userId, amountCents);
  await persistLedgerTransaction({
    userId,
    type: "deposit",
    amountCents,
    balanceAfterCents: balanceAfter,
    referenceId: txId,
    algoTxId: txId,
    description: "ALGO deposit credited to gateway balance",
    status: "confirmed",
  });

  return { ok: true, amountCents, balanceCents: balanceAfter, depositId: deposit._id };
}

export async function pollRecentVaultDeposits({ limit = 20 } = {}) {
  const vault = vaultAddress();
  if (!vault || !algosdk.isValidAddress(vault)) return { processed: 0 };

  const indexer = new algosdk.Indexer(
    "",
    (process.env.ALGO_INDEXER_URL || process.env.ALGORAND_INDEXER || "https://testnet-idx.algonode.cloud").replace(
      /\/$/,
      ""
    ),
    ""
  );

  let txs;
  try {
    const resp = await indexer.lookupAccountTransactions(vault).limit(limit).do();
    txs = resp.transactions || [];
  } catch (e) {
    console.warn("[gatewayDeposit] poll failed:", e?.message);
    return { processed: 0, error: e.message };
  }

  let processed = 0;
  for (const tx of txs) {
    const txId = tx.id;
    if (!txId) continue;
    const exists = await GatewayDeposit.findOne({ txId }).lean();
    if (exists) continue;

    const parsed = parsePaymentFromIndexer({ transaction: tx });
    if (!parsed) continue;

    const userId = parseDepositNote(decodeNote(parsed.note));
    if (!userId) continue;

    const user = await User.findById(userId).lean();
    if (!user) continue;

    try {
      await confirmDepositByTxId({ userId, txId });
      processed++;
    } catch (e) {
      console.warn("[gatewayDeposit] skip tx", txId, e.message);
    }
  }

  return { processed };
}
