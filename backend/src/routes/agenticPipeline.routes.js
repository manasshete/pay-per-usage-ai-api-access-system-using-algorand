import { Router } from "express";
import * as agentic from "../controllers/agenticPipeline.controller.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { checkPromptQuota } from "../middleware/studioQuota.js";

const router = Router();

router.post("/run", checkPromptQuota, uploadMiddleware.single("image"), agentic.startRun);
router.get("/runs", agentic.getRuns);
router.get("/runs/:id", agentic.getRunById);

export default router;
