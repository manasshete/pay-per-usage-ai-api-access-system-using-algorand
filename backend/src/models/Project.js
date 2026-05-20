import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    brandVoice: { type: String, default: "" },
    connectedPlatforms: [{ type: String }],
    color: { type: String, default: "#031634" },
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
