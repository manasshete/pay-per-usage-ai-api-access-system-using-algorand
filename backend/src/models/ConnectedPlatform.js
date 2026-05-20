import mongoose from "mongoose";

const platformEnum = ["medium", "linkedin", "devto", "hashnode", "wordpress"];

const connectedPlatformSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    platform: { type: String, enum: platformEnum, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    connectedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

connectedPlatformSchema.index({ userId: 1, platform: 1 }, { unique: true });

export const ConnectedPlatform = mongoose.model("ConnectedPlatform", connectedPlatformSchema);
