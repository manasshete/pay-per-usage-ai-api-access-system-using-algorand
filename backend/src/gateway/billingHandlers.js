import {
  finalizeBalanceCents,
  refundLockedCents,
  getBalanceCents,
} from "../services/gatewayBalanceService.js";
import {
  persistUsageRecord,
  persistLedgerTransaction,
  persistDeveloperEarning,
  syncBalanceToMongo,
} from "../services/gatewayPersistence.js";
import { updateGatewayAnalytics } from "./analytics.js";
import { platformFeeFromGross } from "./costCalculator.js";
import { runGatewayEventAlerts } from "../services/gatewayMonitor.js";

export async function completeGatewayBilling({
  consumerId,
  api,
  subscription,
  requestId,
  method,
  forwardPath,
  estimatedCostCents,
  actualCostCents,
  billingStatus,
  requestStatus,
  httpStatus,
  responseTimeMs,
  tokens,
  errorMessage,
  apiKeyPrefix,
  projectId,
}) {
  const charged = billingStatus === "charged";
  const actual = charged ? actualCostCents : 0;

  if (!charged) {
    await refundLockedCents(consumerId, estimatedCostCents);
  } else {
    await finalizeBalanceCents(consumerId, estimatedCostCents, actual);
  }

  const balanceAfter = await getBalanceCents(consumerId);
  void syncBalanceToMongo(consumerId, balanceAfter);

  const { platformFeeCents, earningCents } = platformFeeFromGross(actual);

  await persistUsageRecord({
    requestId,
    consumerId,
    developerId: api.developerId,
    apiId: api._id,
    subscriptionId: subscription._id,
    apiKeyPrefix: apiKeyPrefix ?? null,
    projectId: projectId ?? null,
    timestamp: new Date(),
    method,
    endpoint: forwardPath,
    requestStatus,
    httpStatus,
    responseTimeMs,
    tokensPrompt: tokens?.prompt ?? null,
    tokensCompletion: tokens?.completion ?? null,
    tokensTotal: tokens?.total ?? null,
    costUnits: 1,
    costCents: actual,
    billingStatus,
    errorMessage: errorMessage ?? null,
  });

  if (charged) {
    await persistLedgerTransaction({
      userId: consumerId,
      type: "deduction",
      amountCents: -actual,
      balanceAfterCents: balanceAfter,
      referenceId: requestId,
      description: `API call ${api.name}`,
      status: "confirmed",
    });
    await persistDeveloperEarning({
      developerId: api.developerId,
      apiId: api._id,
      requestId,
      grossCents: actual,
      platformFeeCents,
      earningCents,
      status: "available",
    });
    await updateGatewayAnalytics({
      consumerId: String(consumerId),
      developerId: String(api.developerId),
      apiId: String(api._id),
      costCents: actual,
      earningCents,
      tokensTotal: tokens?.total || 0,
      success: true,
    });
  }

  void runGatewayEventAlerts({
    userId: consumerId,
    developerId: api.developerId,
    apiId: api._id,
    balanceCents: balanceAfter,
    costCents: actual,
    requestStatus,
    httpStatus,
    success: charged,
  }).catch(() => {});

  return { balanceAfter, actualCostCents: actual, earningCents };
}
