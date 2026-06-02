import {
  CREDIT_WEIGHTS,
  RUNTYPE_TO_OVERAGE,
  OVERAGE_PRICES,
  RUN_TYPE_LABELS,
  getFeatureGates,
  getPlanCredits,
} from "../constants/studioPlans.js";
import { assertBlogQuota, ensureUsageMonth } from "../services/blog.service.js";
import { assertFeatureGate, inferWorkflowRunType } from "../services/studioCredits.js";
import { limitForTier } from "../constants/studioLimits.js";

export async function checkBlogQuota(req, res, next) {
  try {
    await assertBlogQuota(req.user.userId);
    next();
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ error: e.message || "Quota check failed" });
  }
}

/**
 * Factory: credit + feature gate middleware for Studio runs.
 * @param {string} [defaultRunType]
 */
export function checkStudioCredits(defaultRunType) {
  return async function checkStudioCreditsMiddleware(req, res, next) {
    try {
      const runType =
        req.body?.runType ||
        (req.workflow ? inferWorkflowRunType(req.workflow.nodes) : null) ||
        defaultRunType;

      if (!runType || !CREDIT_WEIGHTS[runType]) {
        return res.status(400).json({
          error: "Invalid or missing runType",
          validRunTypes: Object.keys(CREDIT_WEIGHTS),
        });
      }

      req.studioRunType = runType;
      const cost = CREDIT_WEIGHTS[runType];

      const user = await ensureUsageMonth(req.user.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const tier = user.subscriptionTier || "free";
      const pool = getPlanCredits(tier);
      try {
        assertFeatureGate(tier, runType);
      } catch (gateErr) {
        return res.status(gateErr.status || 403).json({
          error: gateErr.message,
          code: gateErr.code,
          requiredPlan: gateErr.requiredPlan,
          runType,
        });
      }

      req.studioCreditCost = cost;

      // Enterprise: soft-unlimited credits (refill pool when exhausted, no x402 friction).
      if (tier === "enterprise") {
        if ((user.studioCredits ?? 0) < cost) {
          user.studioCredits = pool;
        }
        user.studioCredits = Math.max(0, (user.studioCredits ?? 0) - cost);
        await user.save();
        req.creditDeducted = true;
        req.creditsRemaining = user.studioCredits;
        req.x402Required = false;
        return next();
      }

      if ((user.studioCredits ?? 0) >= cost) {
        user.studioCredits = Math.max(0, (user.studioCredits ?? 0) - cost);
        await user.save();
        req.creditDeducted = true;
        req.creditsRemaining = user.studioCredits;
        req.x402Required = false;
        return next();
      }

      req.creditDeducted = false;
      req.x402Required = true;
      req.x402RunType = runType;
      req.x402OverageTier = RUNTYPE_TO_OVERAGE[runType] ?? "lite";
      req.x402AmountMicro = OVERAGE_PRICES[req.x402OverageTier];
      req.creditsRemaining = user.studioCredits ?? 0;
      req.studioCreditPool = pool;
      return next();
    } catch (e) {
      const status = e.status || 500;
      res.status(status).json({ error: e.message || "Credit check failed" });
    }
  };
}

export async function attachUsageSummary(req, res, next) {
  try {
    const user = await ensureUsageMonth(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    req.usageUser = user;
    const tier = user.subscriptionTier || "free";
    const blogCap = limitForTier(tier, "blogsPerMonth");
    const creditPool = getPlanCredits(tier);
    const gates = getFeatureGates(tier);
    req.blogQuota = {
      used: user.monthlyBlogsUsed || 0,
      limit: blogCap,
      tier,
    };
    req.studioCreditQuota = {
      remaining: user.studioCredits ?? 0,
      pool: creditPool,
      tier,
      usageResetAt: user.usageResetAt,
      featureGates: gates,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/** Legacy alias — maps to prompt_single credit check. */
export async function checkPromptQuota(req, res, next) {
  return checkStudioCredits("prompt_single")(req, res, next);
}

export { RUN_TYPE_LABELS };
