import { Router } from "express";
import * as agentic from "../controllers/agenticPipeline.controller.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { checkStudioCredits } from "../middleware/studioQuota.js";
import { conditionalX402Gate } from "../middleware/x402OverageGate.js";

const router = Router();

router.post(
  "/run",
  uploadMiddleware.single("image"),
  checkStudioCredits("agentic_text"),
  conditionalX402Gate,
  agentic.startRun
);
router.get("/runs", agentic.getRuns);
router.get("/runs/:id", agentic.getRunById);

export default router;
