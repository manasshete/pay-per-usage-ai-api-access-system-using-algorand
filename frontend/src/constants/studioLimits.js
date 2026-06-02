/** Display limits — credit pools from studioPlans.js */
import { PLAN_CREDITS } from "./studioPlans.js";

export const CREDITS_BY_TIER = PLAN_CREDITS;

export function creditLimitLabel(tier) {
  const n = PLAN_CREDITS[tier] ?? PLAN_CREDITS.free;
  return `${n} credits / month`;
}
