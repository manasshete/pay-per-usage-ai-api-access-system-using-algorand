import { Router } from "express";
import { runGatewayPipeline } from "../gateway/pipeline.js";

const router = Router({ mergeParams: true });

router.use((req, res, next) => {
  req.gatewaySlug = req.params.slug;
  const raw = req.url || "";
  req.gatewayForwardPath = raw.length > 0 ? raw : "/chat/completions";
  next();
});

router.all("*", runGatewayPipeline);

export default router;
