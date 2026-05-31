import algosdk, { waitForConfirmation } from "algosdk";
import { DeveloperEarning } from "../models/DeveloperEarning.js";
import { User } from "../models/User.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { getPlatformTreasuryKey } from "./platformTreasuryKey.js";
import { persistLedgerTransaction } from "./gatewayPersistence.js";
import { algoToMicroAlgos, fetchAccountBalanceMicroAlgos } from "./algorandService.js";

const MIN_PAYOUT_CENTS = Number(process.env.GATEWAY_MIN_PAYOUT_CENTS || 500);

function getAlgodClient() {
  const server = (
    process.env.ALGOD_SERVER ||
    process.env.ALGORAND_NODE ||
    "https://testnet-api.algonode.cloud"
  ).replace(/\/$/, "");
  return new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", server, "");
}

export async function getDeveloperEarningsSummary(developerId) {
  const [pendingRow, availableRow, paidRow] = await Promise.all([
    DeveloperEarning.aggregate([
      { $match: { developerId, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$earningCents" } } },
    ]),
    DeveloperEarning.aggregate([
      { $match: { developerId, status: "available" } },
      { $group: { _id: null, total: { $sum: "$earningCents" } } },
    ]),
    DeveloperEarning.aggregate([
      { $match: { developerId, status: "paid_out" } },
      { $group: { _id: null, total: { $sum: "$earningCents" } } },
    ]),
  ]);

  return {
    pendingCents: pendingRow[0]?.total ?? 0,
    availableCents: availableRow[0]?.total ?? 0,
    paidOutCents: paidRow[0]?.total ?? 0,
    minPayoutCents: MIN_PAYOUT_CENTS,
  };
}

function centsToMicroAlgos(cents) {
  const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
  const algo = (Number(cents) || 0) / rate;
  return algoToMicroAlgos(Math.max(0.001, algo));
}

export async function requestGatewayPayout({ developerId, amountCents }) {
  const amount = Math.round(Number(amountCents) || 0);
  if (amount < MIN_PAYOUT_CENTS) {
    throw Object.assign(new Error(`Minimum payout is ${MIN_PAYOUT_CENTS} cents`), { status: 400 });
  }

  const summary = await getDeveloperEarningsSummary(developerId);
  if (amount > summary.availableCents) {
    throw Object.assign(new Error("Amount exceeds available earnings"), {
      status: 400,
      summary,
    });
  }

  const dev = await User.findById(developerId).select("walletAddress algoAddress").lean();
  const receiver = String(dev?.algoAddress || dev?.walletAddress || "").trim();
  if (!receiver || !algosdk.isValidAddress(receiver)) {
    throw Object.assign(new Error("Developer has no valid Algorand address"), { status: 400 });
  }

  const treasury = await getPlatformTreasuryKey();
  const microAlgos = centsToMicroAlgos(amount);
  const treasuryBalance = await fetchAccountBalanceMicroAlgos(treasury.addr);
  if (treasuryBalance < microAlgos + 1000) {
    throw Object.assign(new Error("Platform treasury has insufficient ALGO for payout"), { status: 502 });
  }

  const earnings = await DeveloperEarning.find({ developerId, status: "available" })
    .sort({ createdAt: 1 })
    .lean();

  let remaining = amount;
  const marked = [];
  for (const row of earnings) {
    if (remaining <= 0) break;
    if (row.earningCents <= remaining) {
      marked.push(row._id);
      remaining -= row.earningCents;
    }
  }
  if (remaining > 0) {
    throw Object.assign(new Error("Could not allocate earnings rows for payout amount"), { status: 400 });
  }

  const client = getAlgodClient();
  const sp = await client.getTransactionParams().do();
  const note = new Uint8Array(Buffer.from(`sentinel:payout:${developerId}:${Date.now()}`, "utf8"));
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: treasury.addr,
    receiver,
    amount: microAlgos,
    note,
    suggestedParams: sp,
  });
  const signed = await treasury.signTransaction(txn);
  const { txId } = await client.sendRawTransaction(signed).do();
  await waitForConfirmation(client, txId, 6);

  await DeveloperEarning.updateMany({ _id: { $in: marked } }, { $set: { status: "paid_out" } });

  await persistLedgerTransaction({
    userId: developerId,
    type: "payout",
    amountCents: amount,
    referenceId: txId,
    algoTxId: txId,
    description: "Gateway earnings payout",
    status: "confirmed",
  });

  return {
    txId,
    amountCents: amount,
    receiver,
    earningsSettled: marked.length,
  };
}

export async function listGatewayPayouts(developerId, { limit = 30 } = {}) {
  return LedgerTransaction.find({ userId: developerId, type: "payout" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
