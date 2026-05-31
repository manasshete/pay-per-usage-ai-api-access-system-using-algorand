import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { DeveloperEarning } from "../models/DeveloperEarning.js";

const router = Router();

/**
 * GET /api/gateway/e2e-verify?requestId=xxx
 *
 * Verifies the complete lifecycle of a gateway request:
 *   1. UsageRecord exists
 *   2. LedgerTransaction (deduction) exists
 *   3. DeveloperEarning exists
 *
 * Returns the full chain so consumers/developers can audit any request.
 */
router.get("/e2e-verify", requireAuth, async (req, res) => {
  const requestId = String(req.query.requestId || "").trim();
  if (!requestId) {
    return res.status(400).json({ error: "requestId query parameter is required" });
  }

  const userId = String(req.user.userId);

  try {
    // Step 1: Find the UsageRecord
    const usage = await UsageRecord.findOne({ requestId })
      .populate("apiId", "name proxySlug pricingModel pricePerUnit")
      .lean();

    if (!usage) {
      return res.status(404).json({
        verified: false,
        error: "No usage record found for this requestId",
        requestId,
      });
    }

    // Access control: user must be either the consumer or the developer
    const isConsumer = String(usage.consumerId) === userId;
    const isDeveloper = String(usage.developerId) === userId;
    if (!isConsumer && !isDeveloper) {
      return res.status(403).json({ error: "You are not authorized to view this request" });
    }

    // Step 2: Find the LedgerTransaction (deduction for the consumer)
    const ledgerTx = await LedgerTransaction.findOne({
      referenceId: requestId,
      type: "deduction",
    }).lean();

    // Step 3: Find the DeveloperEarning
    const earning = await DeveloperEarning.findOne({
      requestId,
    }).lean();

    // Build verification result
    const steps = {
      usageRecorded: {
        ok: true,
        data: {
          requestId: usage.requestId,
          apiName: usage.apiId?.name,
          proxySlug: usage.apiId?.proxySlug,
          method: usage.method,
          endpoint: usage.endpoint,
          httpStatus: usage.httpStatus,
          requestStatus: usage.requestStatus,
          billingStatus: usage.billingStatus,
          costCents: usage.costCents,
          tokensTotal: usage.tokensTotal,
          responseTimeMs: usage.responseTimeMs,
          timestamp: usage.timestamp,
        },
      },
      billingDeducted: {
        ok: Boolean(ledgerTx),
        data: ledgerTx
          ? {
              type: ledgerTx.type,
              amountCents: ledgerTx.amountCents,
              balanceAfterCents: ledgerTx.balanceAfterCents,
              status: ledgerTx.status,
              createdAt: ledgerTx.createdAt,
            }
          : null,
        note: !ledgerTx
          ? usage.billingStatus === "failed"
            ? "Request was not billed (failed status)"
            : "Ledger transaction pending or not found"
          : undefined,
      },
      developerPaid: {
        ok: Boolean(earning),
        data: earning
          ? {
              grossCents: earning.grossCents,
              platformFeeCents: earning.platformFeeCents,
              earningCents: earning.earningCents,
              status: earning.status,
            }
          : null,
        note: !earning
          ? usage.billingStatus === "failed"
            ? "No earnings for failed requests"
            : "Developer earning pending or not found"
          : undefined,
      },
    };

    const allOk =
      steps.usageRecorded.ok &&
      (steps.billingDeducted.ok || usage.billingStatus !== "charged") &&
      (steps.developerPaid.ok || usage.billingStatus !== "charged");

    return res.json({
      verified: allOk,
      requestId,
      steps,
    });
  } catch (e) {
    console.error("[e2e-verify]", e?.message || e);
    return res.status(500).json({ error: "Verification failed", detail: e?.message });
  }
});

export default router;
