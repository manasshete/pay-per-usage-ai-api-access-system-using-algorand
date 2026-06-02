/**
 * One-off / CLI: grant Studio subscription tier without on-chain payment.
 * Usage: node scripts/grant-studio-tier.mjs <userId|email> [tier]
 */
import "../src/loadEnv.js";
import { connectDb } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { getPlanCredits } from "../src/constants/studioPlans.js";
import { resetMonthlyCredits } from "../src/services/studioCredits.js";

const tierArg = (process.argv[3] || "enterprise").toLowerCase().trim();
const lookup = process.argv[2];

const VALID = new Set(["free", "creator", "pro", "enterprise"]);

async function main() {
  if (!lookup) {
    console.error("Usage: node scripts/grant-studio-tier.mjs <userId|email> [tier]");
    process.exit(1);
  }
  if (!VALID.has(tierArg)) {
    console.error(`Invalid tier "${tierArg}". Use: free, creator, pro, enterprise`);
    process.exit(1);
  }

  await connectDb();

  const query = lookup.includes("@")
    ? { email: lookup.trim().toLowerCase() }
    : { _id: lookup.trim() };

  const user = await User.findOne(query);
  if (!user) {
    console.error("User not found:", lookup);
    process.exit(1);
  }

  const previous = user.subscriptionTier || "free";
  user.subscriptionTier = tierArg;

  const usageResetAt = new Date();
  usageResetAt.setDate(usageResetAt.getDate() + 30);
  user.usageResetAt = usageResetAt;
  user.monthlyBlogsUsed = 0;
  user.monthlyPromptsUsed = 0;
  resetMonthlyCredits(user);
  await user.save();

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: user._id.toString(),
        email: user.email || null,
        displayName: user.displayName || null,
        previousTier: previous,
        tier: tierArg,
        studioCredits: user.studioCredits,
        studioCreditPool: getPlanCredits(tierArg),
        usageResetAt: user.usageResetAt,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
