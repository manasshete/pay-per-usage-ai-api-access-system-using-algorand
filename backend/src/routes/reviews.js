import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Service } from "../models/Service.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

const router = Router();

async function syncServiceRating(serviceId) {
  const oid = new mongoose.Types.ObjectId(String(serviceId));
  const [row] = await Review.aggregate([
    { $match: { serviceId: oid } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const averageRating = row ? Math.round(row.avg * 10) / 10 : 0;
  const reviewCount = row?.count ?? 0;
  await Service.findByIdAndUpdate(serviceId, { averageRating, reviewCount });
  return { averageRating, reviewCount };
}

router.get(
  "/:serviceId",
  param("serviceId").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { serviceId } = req.params;
    const service = await Service.findById(serviceId).select("_id").lean();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const reviews = await Review.find({ serviceId }).sort({ updatedAt: -1 }).lean();
    const wallets = [...new Set(reviews.map((r) => r.userWallet))];
    const users = wallets.length
      ? await User.find({ walletAddress: { $in: wallets } })
          .select("walletAddress displayName photoURL")
          .lean()
      : [];
    const userByWallet = Object.fromEntries(users.map((u) => [u.walletAddress, u]));

    res.json(
      reviews.map((r) => ({
        id: r._id,
        serviceId: r.serviceId,
        userWallet: r.userWallet,
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        displayName: userByWallet[r.userWallet]?.displayName ?? null,
        photoURL: userByWallet[r.userWallet]?.photoURL ?? null,
      }))
    );
  }
);

router.post(
  "/",
  requireAuth,
  body("serviceId").isMongoId(),
  body("rating").isInt({ min: 1, max: 5 }),
  body("reviewText").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let userWallet;
    try {
      userWallet = canonicalWalletAddress(req.user.walletAddress);
    } catch {
      return res.status(400).json({ error: "Valid wallet address required to submit a review" });
    }

    const { serviceId, rating, reviewText = "" } = req.body;
    const service = await Service.findById(serviceId).select("_id").lean();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const review = await Review.findOneAndUpdate(
      { serviceId, userWallet },
      { rating: Number(rating), reviewText: String(reviewText || "").trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const aggregates = await syncServiceRating(serviceId);

    res.status(201).json({
      review: {
        id: review._id,
        serviceId: review.serviceId,
        userWallet: review.userWallet,
        rating: review.rating,
        reviewText: review.reviewText,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
      averageRating: aggregates.averageRating,
      reviewCount: aggregates.reviewCount,
    });
  }
);

export default router;
