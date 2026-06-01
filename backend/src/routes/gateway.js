import { Router } from "express";
import { body, query, validationResult } from "express-validator";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  syncAllServicesToProxyApis,
  syncServiceToProxyApi,
  migrateAccessTokensToSubscriptions,
  migrateApiUsageLogs,
  ensureSentinelApiKey,
  getMigrationStatus,
} from "../services/marketplaceMigration.js";
import { creditBalanceCents, getBalanceCents } from "../services/gatewayBalanceService.js";
import {
  getDepositInstructions,
  confirmDepositByTxId,
} from "../services/gatewayDepositService.js";
import {
  requestGatewayPayout,
  getDeveloperEarningsSummary,
  listGatewayPayouts,
} from "../services/gatewayPayoutService.js";
import {
  getConsumerDashboard,
  getDeveloperDashboard,
  getUsageLogs,
} from "../services/gatewayDashboardService.js";
import {
  listAlertConfigs,
  upsertAlertConfig,
} from "../services/gatewayAlertService.js";
import {
  getMarketplaceHome,
  searchMarketplaceApis,
  listCategories,
  getTrendingApis,
  getPopularApis,
} from "../services/gatewayMarketplaceService.js";
import { getAdminDashboard, isGatewayAdmin } from "../services/gatewayAdminService.js";
import { runGatewayHealthAudit, sampleConsumerTrace } from "../services/gatewayAuditService.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import usageVerificationRoutes from "./usageVerification.js";

function requireGatewayAdmin(req, res, next) {
  if (isGatewayAdmin(req.user)) return next();
  return res.status(403).json({ error: "Gateway admin access required" });
}

const router = Router();

function requireMigrationSecret(req, res, next) {
  const secret = process.env.GATEWAY_MIGRATION_SECRET?.trim();
  if (!secret) return next();
  if (req.headers["x-migration-secret"] === secret) return next();
  return res.status(403).json({ error: "Migration secret required" });
}

// ——— Migration ———
router.get("/status", requireAuth, requireRole("creator"), async (_req, res) => {
  res.json(await getMigrationStatus());
});

router.post(
  "/migrate/services",
  requireAuth,
  requireRole("creator"),
  requireMigrationSecret,
  async (req, res) => {
    res.json(await syncAllServicesToProxyApis({ onlyActive: req.body?.onlyActive !== false }));
  }
);

router.post(
  "/migrate/service/:serviceId",
  requireAuth,
  requireRole("creator"),
  requireMigrationSecret,
  async (req, res) => {
    res.json(await syncServiceToProxyApi(req.params.serviceId));
  }
);

router.post(
  "/migrate/subscriptions",
  requireAuth,
  requireRole("creator"),
  requireMigrationSecret,
  async (req, res) => {
    res.json(await migrateAccessTokensToSubscriptions({ limit: Number(req.body?.limit) || 500 }));
  }
);

router.post(
  "/migrate/usage-logs",
  requireAuth,
  requireRole("creator"),
  requireMigrationSecret,
  async (req, res) => {
    res.json(
      await migrateApiUsageLogs({
        limit: Number(req.body?.limit) || 200,
        dryRun: Boolean(req.body?.dryRun),
      })
    );
  }
);

// ——— Consumer ———
router.post("/keys/issue", requireAuth, async (req, res) => {
  try {
    res.json(await ensureSentinelApiKey(req.user.userId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/balance", requireAuth, async (req, res) => {
  const cents = await getBalanceCents(req.user.userId);
  res.json({ balanceCents: cents, balanceUsd: (cents / 100).toFixed(2) });
});

router.get("/deposit/instructions", requireAuth, async (req, res) => {
  try {
    res.json(getDepositInstructions(req.user.userId));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

router.post(
  "/deposit/confirm",
  requireAuth,
  body("txId").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      res.json(await confirmDepositByTxId({ userId: req.user.userId, txId: req.body.txId }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  "/balance/credit",
  requireAuth,
  requireMigrationSecret,
  body("amountCents").isInt({ min: 1, max: 1_000_000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const after = await creditBalanceCents(req.user.userId, req.body.amountCents);
    res.json({ balanceCents: after });
  }
);

router.get("/consumer/dashboard", requireAuth, async (req, res) => {
  res.json(await getConsumerDashboard(req.user.userId));
});

router.get(
  "/usage-logs",
  requireAuth,
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    res.json(
      await getUsageLogs(req.user.userId, {
        role: req.user.role,
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 25,
        apiId: req.query.apiId,
      })
    );
  }
);

router.get("/alerts", requireAuth, async (req, res) => {
  res.json(await listAlertConfigs(req.user.userId));
});

router.post(
  "/alerts",
  requireAuth,
  body("type").isIn([
    "low_balance",
    "high_spending",
    "high_usage",
    "monthly_budget",
    "api_outage",
    "rate_limit",
  ]),
  body("thresholdCents").isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await upsertAlertConfig(req.user.userId, req.body);
    res.json(doc);
  }
);

router.post(
  "/subscribe",
  requireAuth,
  body("proxySlug").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const api = await ProxyApi.findOne({
      proxySlug: req.body.proxySlug.toLowerCase(),
      isActive: true,
    });
    if (!api) return res.status(404).json({ error: "API not found" });

    let sub = await GatewaySubscription.findOne({
      consumerId: req.user.userId,
      apiId: api._id,
    });

    if (!sub) {
      sub = await GatewaySubscription.create({
        consumerId: req.user.userId,
        apiId: api._id,
        developerIssuedKey: `sk-sentinel-${crypto.randomBytes(32).toString("hex")}`,
        isActive: true,
      });
    } else if (!sub.isActive) {
      sub.isActive = true;
      await sub.save();
    }

    res.json({
      subscriptionId: sub._id,
      apiKey: sub.developerIssuedKey,
      proxyUrl: `/proxy/${api.proxySlug}/chat/completions`,
      pricePerUnitCents: api.pricePerUnit,
      pricingModel: api.pricingModel,
    });
  }
);

// ——— Developer ———
router.get("/developer/dashboard", requireAuth, requireRole("creator"), async (req, res) => {
  res.json(await getDeveloperDashboard(req.user.userId));
});

router.get("/developer/earnings", requireAuth, requireRole("creator"), async (req, res) => {
  res.json(await getDeveloperEarningsSummary(req.user.userId));
});

router.post(
  "/developer/payout",
  requireAuth,
  requireRole("creator"),
  body("amountCents").optional().isInt({ min: 1 }),
  body("amountAlgo").optional().isFloat({ min: 0.0001 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
    let amountCents = req.body.amountCents;
    if (req.body.amountAlgo) {
      amountCents = Math.round(Number(req.body.amountAlgo) * rate);
    }

    if (!amountCents || amountCents < 1) {
      return res.status(400).json({ error: "Valid amountAlgo or amountCents is required" });
    }

    try {
      res.json(await requestGatewayPayout({
        developerId: req.user.userId,
        amountCents,
      }));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get("/developer/payouts", requireAuth, requireRole("creator"), async (req, res) => {
  res.json(await listGatewayPayouts(req.user.userId));
});

// ——— Public catalog & marketplace ———
router.get("/apis", async (_req, res) => {
  res.json(await searchMarketplaceApis({ limit: 100 }));
});

router.get("/marketplace", async (_req, res) => {
  res.json(await getMarketplaceHome());
});

router.get("/marketplace/categories", async (_req, res) => {
  res.json(listCategories());
});

router.get("/marketplace/trending", async (_req, res) => {
  res.json(await getTrendingApis(12));
});

router.get("/marketplace/popular", async (_req, res) => {
  res.json(await getPopularApis(12));
});

router.get(
  "/marketplace/search",
  query("q").optional().isString(),
  query("category").optional().isString(),
  async (req, res) => {
    res.json(
      await searchMarketplaceApis({
        q: req.query.q,
        category: req.query.category,
        limit: 50,
      })
    );
  }
);

// ——— Admin & audit ———
router.get("/audit/health", requireAuth, requireGatewayAdmin, async (_req, res) => {
  res.json(await runGatewayHealthAudit());
});

router.get("/audit/trace", requireAuth, async (req, res) => {
  if (!isGatewayAdmin(req.user) && req.query.userId && req.query.userId !== String(req.user.userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const uid = req.query.userId || req.user.userId;
  res.json(await sampleConsumerTrace(uid));
});

router.get("/admin/dashboard", requireAuth, requireGatewayAdmin, async (_req, res) => {
  res.json(await getAdminDashboard());
});

// ——— E2E verification ———
router.use("/", usageVerificationRoutes);

export default router;
