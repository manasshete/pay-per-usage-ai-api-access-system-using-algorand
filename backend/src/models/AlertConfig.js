import mongoose from "mongoose";

const alertConfigSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["low_balance", "high_spending", "high_usage", "monthly_budget", "rate_limit", "api_outage"],
      required: true,
    },
    thresholdCents: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
    notifyEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

alertConfigSchema.index({ userId: 1, type: 1 });

export const AlertConfig = mongoose.model("AlertConfig", alertConfigSchema);
