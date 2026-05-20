/** Studio subscription prices in microAlgos (1 ALGO = 1_000_000 microAlgos). */
export const PLAN_PRICES = {
  creator: 5_000_000,
  pro: 15_000_000,
  enterprise: 40_000_000,
};

export const PAID_TIERS = ["creator", "pro", "enterprise"];

export function getPlanPriceMicro(tier) {
  return PLAN_PRICES[tier] ?? null;
}

export function isPaidTier(tier) {
  return PAID_TIERS.includes(tier);
}
