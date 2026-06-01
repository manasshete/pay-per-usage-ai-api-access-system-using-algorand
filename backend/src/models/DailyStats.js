import mongoose from "mongoose";

const dailyStatsSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ["consumer", "developer", "api"], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: Date, required: true, index: true },
    totalCalls: { type: Number, default: 0 },
    successCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    totalCostCents: { type: Number, default: 0 },
    totalRevenueCents: { type: Number, default: 0 },
    avgResponseTimeMs: { type: Number, default: 0 },
    p95ResponseTimeMs: { type: Number, default: 0 },
    uniqueApis: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyStatsSchema.index({ entityType: 1, entityId: 1, date: 1 }, { unique: true });

export const DailyStats = mongoose.model("DailyStats", dailyStatsSchema);
