import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    paymentTxId: { type: String }, // To track which Algo tx paid for this message if assistant
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Auth token sub (Sentinal user ID)
    walletAddress: { type: String },
    title: { type: String, default: "New Chat" },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
