import mongoose from "mongoose";

const agentOutputSchema = new mongoose.Schema(
  {
    agent: { type: String, enum: ["text", "image", "video", "audio", "code"] },
    content: { type: mongoose.Schema.Types.Mixed },
    meta: { type: Object, default: {} },
  },
  { _id: false }
);

const pipelineRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    inputText: { type: String, required: true },
    imagePath: { type: String, default: null },
    chain: [{ type: String }],
    outputs: [agentOutputSchema],
    evalScore: { type: Number },
    evalPassed: { type: Boolean },
    evalFeedback: { type: String, default: "" },
    deliveryUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
  },
  { timestamps: true }
);

pipelineRunSchema.index({ userId: 1, createdAt: -1 });

export const PipelineRun = mongoose.model("PipelineRun", pipelineRunSchema);
