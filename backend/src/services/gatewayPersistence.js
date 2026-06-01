import { UsageRecord } from "../models/UsageRecord.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { DeveloperEarning } from "../models/DeveloperEarning.js";
import { User } from "../models/User.js";
import { enqueueGatewayJob } from "../queues/gatewayQueue.js";

export async function persistUsageRecord(record) {
  const queued = await enqueueGatewayJob("usageWriter", { record });
  if (!queued) {
    await UsageRecord.create(record);
  }
}

export async function persistLedgerTransaction(tx) {
  const queued = await enqueueGatewayJob("txWriter", { tx });
  if (!queued) {
    await LedgerTransaction.create(tx);
  }
}

export async function persistDeveloperEarning(earning) {
  const queued = await enqueueGatewayJob("earningWriter", { earning });
  if (!queued) {
    await DeveloperEarning.create(earning);
  }
}

export async function syncBalanceToMongo(userId, balanceCents) {
  const queued = await enqueueGatewayJob("balanceSync", {
    userId: String(userId),
    balanceCents: Math.round(Number(balanceCents) || 0),
  });
  if (!queued) {
    await User.findByIdAndUpdate(userId, {
      $set: { walletBalanceCents: Math.max(0, Math.round(Number(balanceCents) || 0)) },
    });
  }
}

export async function writeUsageRecordInline(record) {
  return UsageRecord.create(record);
}

export async function writeLedgerTxInline(tx) {
  return LedgerTransaction.create(tx);
}

export async function writeEarningInline(earning) {
  return DeveloperEarning.create(earning);
}
