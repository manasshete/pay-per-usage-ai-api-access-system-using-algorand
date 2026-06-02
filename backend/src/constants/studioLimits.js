/** Non-credit Studio limits — blogs and projects (from FEATURE_GATES). */
import { FEATURE_GATES } from "./studioPlans.js";

export const STUDIO_TIER_LIMITS = {
  free: {
    blogsPerMonth: FEATURE_GATES.free.maxBlogs,
    maxProjects: FEATURE_GATES.free.maxProjects,
  },
  creator: {
    blogsPerMonth: FEATURE_GATES.creator.maxBlogs,
    maxProjects: FEATURE_GATES.creator.maxProjects,
  },
  pro: {
    blogsPerMonth: FEATURE_GATES.pro.maxBlogs,
    maxProjects: FEATURE_GATES.pro.maxProjects,
  },
  enterprise: {
    blogsPerMonth: FEATURE_GATES.enterprise.maxBlogs,
    maxProjects: FEATURE_GATES.enterprise.maxProjects,
  },
};

export function limitForTier(tier, key) {
  const cap = STUDIO_TIER_LIMITS[tier]?.[key];
  if (cap === Infinity) return null;
  return cap ?? STUDIO_TIER_LIMITS.free[key];
}
