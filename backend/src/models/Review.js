import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    userWallet: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

reviewSchema.index({ serviceId: 1, userWallet: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
