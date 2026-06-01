import mongoose from "mongoose";
import { Project } from "../models/Project.js";

export async function resolveProjectId(userId, headerValue) {
  const raw = String(headerValue || "").trim();
  if (!raw) return null;

  if (mongoose.isValidObjectId(raw)) {
    const p = await Project.findOne({ _id: raw, userId }).select("_id").lean();
    return p?._id ?? null;
  }

  const byTitle = await Project.findOne({
    userId,
    title: new RegExp(`^${escapeRegex(raw)}$`, "i"),
  })
    .select("_id")
    .lean();
  return byTitle?._id ?? null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
