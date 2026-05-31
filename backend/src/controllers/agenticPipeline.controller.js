import { runPipeline } from "../services/agenticOrchestrator.js";
import { PipelineRun } from "../models/PipelineRun.js";
import { incrementPromptUsage } from "../services/blog.service.js";

export async function startRun(req, res) {
  const inputText = req.body?.inputText;
  const userId = req.user.userId;

  if (!inputText?.trim()) {
    return res.status(400).json({ error: "inputText is required" });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": heartbeat\n\n");
  }, 25000);

  try {
    const run = await runPipeline(
      userId,
      inputText.trim(),
      req.file?.path || null,
      (progress) => sendEvent({ type: "progress", ...progress })
    );
    sendEvent({ type: "complete", runId: run._id.toString(), run });
    await incrementPromptUsage(userId);
  } catch (err) {
    console.error("[agentic pipeline]", err);
    sendEvent({ type: "error", message: err.message || "Pipeline failed" });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

export async function getRuns(req, res) {
  try {
    const runs = await PipelineRun.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ runs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRunById(req, res) {
  try {
    const run = await PipelineRun.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json({ run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
