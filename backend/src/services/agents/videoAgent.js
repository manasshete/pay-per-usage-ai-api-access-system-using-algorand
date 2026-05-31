import { extractVisualPromptsFromScript } from "../../utils/scriptSceneParser.js";
import {
  getVeoModelIds,
  isVertexPermissionError,
  veoOutputStorageUri,
  VEO_ALLOWLIST_HELP,
} from "../../utils/vertexHelpers.js";
import { vertexFetch } from "../../utils/vertexAuth.js";

async function pollVeoOperation(operationName, modelId, project, location) {
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
  const interval = 10_000;
  const deadline = Date.now() + 300_000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await vertexFetch(url, {
      method: "POST",
      body: JSON.stringify({ operationName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "Veo status check failed");
    }
    if (data.done) {
      if (data.error) throw new Error(data.error.message || "Veo operation failed");
      return data.response;
    }
  }
  throw new Error("Veo operation timed out after 5 minutes");
}

function buildVideoPrompt(inputText, memory, priorOutput) {
  if (priorOutput?.agent === "text") {
    const scenes = extractVisualPromptsFromScript(priorOutput.content, 3).join(". ");
    if (scenes) {
      const tone = memory.preferences?.tone || "cinematic";
      return `${scenes}. Style: ${tone}, 4K, smooth camera motion.`;
    }
  }
  if (priorOutput?.agent === "image") {
    return `${priorOutput.meta?.prompt || inputText}. Animate with smooth motion, cinematic quality.`;
  }
  return inputText;
}

async function submitVeoJob(modelId, videoPrompt, project, location) {
  const baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
  const storageUri = veoOutputStorageUri();

  const parameters = {
    aspectRatio: "16:9",
    sampleCount: 1,
    durationSeconds: 8,
  };
  if (storageUri) {
    parameters.storageUri = storageUri;
  }

  const submitRes = await vertexFetch(
    `${baseUrl}/publishers/google/models/${modelId}:predictLongRunning`,
    {
      method: "POST",
      body: JSON.stringify({
        instances: [{ prompt: videoPrompt }],
        parameters,
      }),
    }
  );

  const submitData = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok) {
    const err = new Error(submitData?.error?.message || "Veo submit failed");
    err.status = submitRes.status;
    throw err;
  }

  return submitData;
}

export async function runVideoAgent(inputText, memory, priorOutput = null) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const videoPrompt = buildVideoPrompt(inputText, memory, priorOutput);
  const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";

  if (!project) {
    return {
      agent: "video",
      content: null,
      meta: {
        model: "veo",
        prompt: videoPrompt,
        skipped: true,
        reason: "Set GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS for Veo.",
      },
    };
  }

  const storageUri = veoOutputStorageUri();
  if (!storageUri) {
    return {
      agent: "video",
      content: null,
      meta: {
        model: "veo",
        prompt: videoPrompt,
        skipped: true,
        reason: "Set GCS_ASSETS_BUCKET in backend/.env — Veo writes output video to that bucket.",
      },
    };
  }

  try {
    const models = getVeoModelIds();
    let lastErr = null;
    let permissionDenied = false;

    for (const modelId of models) {
      try {
        const submitData = await submitVeoJob(modelId, videoPrompt, project, location);
        const operationName = submitData.name;
        if (!operationName) throw new Error("Veo returned no operation name");

        const response = await pollVeoOperation(operationName, modelId, project, location);
        const gcsUri =
          response?.videos?.[0]?.gcsUri ||
          response?.predictions?.[0]?.gcsUri ||
          response?.predictions?.[0]?.video?.gcsUri ||
          null;

        return {
          agent: "video",
          content: gcsUri,
          meta: {
            model: modelId,
            prompt: videoPrompt,
            operationName,
            storageUri,
          },
        };
      } catch (err) {
        lastErr = err;
        const msg = err.message || "";
        if (isVertexPermissionError(msg)) {
          permissionDenied = true;
          break;
        }
        console.warn(`[veo] ${modelId} failed:`, msg.slice(0, 160));
      }
    }

    const errMsg = lastErr?.message?.slice(0, 300) || "Veo failed";
    return {
      agent: "video",
      content: null,
      meta: {
        model: "veo",
        prompt: videoPrompt,
        skipped: permissionDenied,
        reason: permissionDenied ? VEO_ALLOWLIST_HELP : errMsg,
        error: errMsg,
      },
    };
  } catch (err) {
    const msg = err.message?.slice(0, 300) || "Veo failed";
    return {
      agent: "video",
      content: null,
      meta: {
        model: "veo",
        prompt: videoPrompt,
        skipped: isVertexPermissionError(msg),
        reason: isVertexPermissionError(msg) ? VEO_ALLOWLIST_HELP : msg,
        error: msg,
      },
    };
  }
}
