import mongoose from "mongoose";

const developerEarningSchema = new mongoose.Schema(
  {
    developerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    apiId: { type: mongoose.Schema.Types.ObjectId, ref: "ProxyApi", required: true, index: true },
    requestId: { type: String, required: true, unique: true, index: true },
    usageRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "UsageRecord", sparse: true },
    grossCents: { type: Number, required: true },
    platformFeeCents: { type: Number, required: true },
    earningCents: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "available", "paid_out"],
      default: "available",
      index: true,
    },
  },
  { timestamps: true }
);

export const DeveloperEarning = mongoose.model("DeveloperEarning", developerEarningSchema);
