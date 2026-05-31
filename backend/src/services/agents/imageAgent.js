import { generateImageFromPrompt } from "../geminiImageService.js";
import {
  extractVisualPromptsFromScript,
  parseKeyframeCount,
} from "../../utils/scriptSceneParser.js";
import { isVertexPermissionError, IMAGEN_PERMISSION_HELP } from "../../utils/vertexHelpers.js";
import { vertexFetch } from "../../utils/vertexAuth.js";

function vertexImagenEnabled() {
  return process.env.VERTEX_IMAGEN_ENABLED === "true";
}

async function runVertexImagen(prompt) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project || !vertexImagenEnabled()) return null;

  const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";
  const model =
    process.env.VERTEX_IMAGEN_MODEL?.trim() || "imagen-3.0-generate-002";
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

  const res = await vertexFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.error?.message || res.statusText;
    if (isVertexPermissionError(errMsg)) {
      console.warn("[imagen]", IMAGEN_PERMISSION_HELP);
    } else {
      console.warn("[imagen]", errMsg?.slice(0, 200));
    }
    return null;
  }

  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) return null;
  return [b64];
}

function buildPrompts(inputText, memory, priorOutput) {
  const tone = memory.preferences?.tone || "cinematic";
  const count = parseKeyframeCount(inputText, 3);

  if (priorOutput?.agent === "text") {
    const visuals = extractVisualPromptsFromScript(priorOutput.content, count);
    if (visuals.length) {
      return visuals.map((v) => `${v}, ${tone} style, 4K, professional photography, 16:9`);
    }
  }

  return [`${inputText}, ${tone} style, 4K, professional photography, 16:9`];
}

export async function runImageAgent(inputText, memory, priorOutput = null) {
  const prompts = buildPrompts(inputText, memory, priorOutput);
  const images = [];
  const dataUrls = [];
  let model = "gemini-image";
  let vertexWarning = null;

  for (const prompt of prompts) {
    let b64List = null;
    if (vertexImagenEnabled()) {
      b64List = await runVertexImagen(prompt);
      if (b64List?.length) {
        model = "imagen-vertex";
        images.push(b64List[0]);
        continue;
      }
      if (!vertexWarning) vertexWarning = "Vertex Imagen unavailable; used Gemini image.";
    }

    try {
      const img = await generateImageFromPrompt(prompt, { aspectRatio: "16:9" });
      images.push(img.base64);
      if (img.dataUrl) dataUrls.push(img.dataUrl);
    } catch (err) {
      throw new Error(
        err.message?.includes("GOOGLE_API_KEY")
          ? "Image generation needs GOOGLE_API_KEY (Gemini image models)."
          : err.message?.slice(0, 200) || "Gemini image generation failed"
      );
    }
  }

  return {
    agent: "image",
    content: images,
    meta: {
      model,
      prompt: prompts.join(" | "),
      count: images.length,
      ...(vertexWarning ? { warning: vertexWarning } : {}),
      ...(dataUrls.length ? { dataUrls } : {}),
    },
  };
}
