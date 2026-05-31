import mongoose from "mongoose";

const usageRecordSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    developerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    apiId: { type: mongoose.Schema.Types.ObjectId, ref: "ProxyApi", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "GatewaySubscription", index: true },
    apiKeyPrefix: { type: String, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    legacyUsageLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiUsageLog",
      sparse: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      default: "POST",
    },
    endpoint: { type: String, default: "" },
    requestStatus: {
      type: String,
      enum: ["success", "failed", "rejected"],
      required: true,
    },
    httpStatus: { type: Number },
    responseTimeMs: { type: Number },
    tokensPrompt: { type: Number },
    tokensCompletion: { type: Number },
    tokensTotal: { type: Number },
    costUnits: { type: Number, default: 1 },
    costCents: { type: Number, default: 0 },
    billingStatus: {
      type: String,
      enum: ["charged", "failed", "rejected", "refunded"],
      required: true,
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

usageRecordSchema.index({ consumerId: 1, timestamp: -1 });
usageRecordSchema.index({ apiId: 1, timestamp: -1 });

export const UsageRecord = mongoose.model("UsageRecord", usageRecordSchema);
