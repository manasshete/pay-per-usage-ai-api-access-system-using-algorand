import mongoose from "mongoose";

const userMemorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

userMemorySchema.index({ userId: 1 });

export const UserMemory = mongoose.model("UserMemory", userMemorySchema);
