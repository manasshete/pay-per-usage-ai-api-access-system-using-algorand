import { assertBlogQuota, ensureUsageMonth } from "../services/blog.service.js";

/** Expects req.user.userId from requireAuth */
export async function checkBlogQuota(req, res, next) {
  try {
    await assertBlogQuota(req.user.userId);
    next();
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ error: e.message || "Quota check failed" });
  }
}

export async function attachUsageSummary(req, res, next) {
  try {
    const user = await ensureUsageMonth(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    req.usageUser = user;
    const tier = user.subscriptionTier || "free";
    const limits = { free: 3, creator: 50, pro: Infinity, enterprise: Infinity };
    const cap = limits[tier] ?? 3;
    req.blogQuota = {
      used: user.monthlyBlogsUsed || 0,
      limit: cap === Infinity ? null : cap,
      tier,
    };
    next();
  } catch (e) {
    next(e);
  }
}
