import {
  OVERAGE_PRICES,
  RUN_TYPE_LABELS,
  microToAlgo,
  microToInr,
  microToUsd,
} from "../constants/studioPlans.js";
import { getPublicReceiverWallet } from "../config/paymentConfig.js";
import {
  buildPaymentRequirements,
  parseXPaymentHeader,
  verifyX402Payment,
} from "../services/x402Middleware.js";
import { logStudioOverage, isOverageTxReplay } from "../services/studioCredits.js";

/**
 * Build x402 payment middleware for a fixed overage tier.
 * @param {keyof typeof OVERAGE_PRICES} overageTier
 */
export function createX402Gate(overageTier) {
  const amountMicro = OVERAGE_PRICES[overageTier];
  if (!amountMicro) {
    throw new Error(`Unknown overage tier: ${overageTier}`);
  }

  return async function x402OverageGate(req, res, next) {
    const payTo = getPublicReceiverWallet();
    if (!payTo) {
      return res.status(500).json({ error: "SENTINEL_WALLET_ADDRESS / RECEIVER_WALLET not configured" });
    }

    const runType = req.x402RunType || req.studioRunType || "prompt_single";
    const xPayment =
      req.headers["x-payment"] || req.headers["X-Payment"] || req.body?.xPayment;

    if (xPayment) {
      const payload = parseXPaymentHeader(xPayment);
      if (!payload) {
        return res.status(400).json({ error: "Invalid X-Payment header" });
      }

      const verified = await verifyX402Payment({
        payload,
        expectedReceiver: payTo,
        expectedMicroAlgos: amountMicro,
      });

      if (!verified.valid) {
        return res.status(402).json({
          error: verified.error || "Payment verification failed",
          studioOverage: buildOveragePayload(runType, overageTier, amountMicro),
        });
      }

      if (await isOverageTxReplay(req.user.userId, verified.txId)) {
        return res.status(409).json({
          error: "Replay attack detected: transaction already used for Studio overage",
        });
      }

      try {
        await logStudioOverage(req.user.userId, {
          runType,
          algoAmount: amountMicro,
          txId: verified.txId,
        });
      } catch (e) {
        if (e.status === 409) {
          return res.status(409).json({ error: e.message });
        }
        throw e;
      }

      req.overagePaid = true;
      req.overageTxId = verified.txId;
      req.x402Required = false;
      return next();
    }

    const requirements = buildPaymentRequirements({
      payTo,
      amountMicroAlgos: amountMicro,
      resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      description: `Sentinel Studio overage — ${overageTier}`,
    });

    const body = {
      x402Version: 1,
      error: "Payment Required",
      accepts: requirements.paymentRequirements,
      studioOverage: buildOveragePayload(runType, overageTier, amountMicro),
      creditsRemaining: req.creditsRemaining ?? 0,
      creditCost: req.studioCreditCost ?? null,
      creditPool: req.studioCreditPool ?? null,
      hint:
        "Connect your wallet and approve the ALGO payment to run this Studio tool.",
    };

    return res
      .status(402)
      .set("Payment-Required", Buffer.from(JSON.stringify(requirements)).toString("base64"))
      .json(body);
  };
}

function buildOveragePayload(runType, overageTier, amountMicro) {
  return {
    runType,
    runTypeLabel: RUN_TYPE_LABELS[runType] || runType,
    overageTier,
    amountMicroAlgos: amountMicro,
    amountAlgo: microToAlgo(amountMicro),
    amountInr: Math.round(microToInr(amountMicro)),
    amountUsd: Number(microToUsd(amountMicro).toFixed(2)),
    facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://facilitator.goplausible.xyz",
    network: process.env.ALGO_NETWORK || "testnet",
  };
}

/** Only invoke x402 when credits are exhausted. */
export async function conditionalX402Gate(req, res, next) {
  if (!req.x402Required) {
    return next();
  }

  const tier = req.x402OverageTier || "lite";
  return createX402Gate(tier)(req, res, next);
}

export { getPublicReceiverWallet as getSentinelWallet } from "../config/paymentConfig.js";
