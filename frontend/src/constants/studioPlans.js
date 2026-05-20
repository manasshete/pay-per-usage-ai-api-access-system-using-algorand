/** Studio plan prices — keep in sync with backend/src/constants/studioPlans.js */
export const PLAN_PRICES = {
  creator: 5_000_000,
  pro: 15_000_000,
  enterprise: 40_000_000,
};

export const PLAN_PRICE_ALGO = {
  creator: 5,
  pro: 15,
  enterprise: 40,
};

export const PAID_TIERS = ["creator", "pro", "enterprise"];

export function upgradeNote(tier, userId) {
  return `sentinel_upgrade:${tier}:${userId}`;
}
