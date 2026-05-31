import mongoose from "mongoose";

const gatewaySubscriptionSchema = new mongoose.Schema(
  {
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    apiId: { type: mongoose.Schema.Types.ObjectId, ref: "ProxyApi", required: true, index: true },
    legacyAccessTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccessToken",
      sparse: true,
    },
    developerIssuedKey: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

gatewaySubscriptionSchema.index({ consumerId: 1, apiId: 1 }, { unique: true });

export const GatewaySubscription = mongoose.model("GatewaySubscription", gatewaySubscriptionSchema);
