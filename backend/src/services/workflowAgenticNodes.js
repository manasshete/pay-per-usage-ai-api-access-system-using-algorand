import fs from "fs";
import { runTextAgent } from "./agents/textAgent.js";
import { runImageAgent } from "./agents/imageAgent.js";
import { runVideoAgent } from "./agents/videoAgent.js";
import { runAudioAgent } from "./agents/audioAgent.js";
import { runCodeAgent } from "./agents/codeAgent.js";
import { muxVideoWithAudio } from "./mediaComposer.js";

const EMPTY_MEMORY = { pastChunks: [], preferences: {} };

const CREDITS = {
  text: 0.008,
  image: 0.018,
  video: 0.05,
  audio: 0.01,
  code: 0.006,
};

export function formatAgenticNodeOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

function tryParseAgenticChunk(chunk) {
  try {
    const p = JSON.parse(String(chunk || "").trim());
    if (p?.kind?.startsWith("agentic")) return p;
  } catch {
    /* plain text */
  }
  return null;
}

/** Scan concatenated upstream outputs (all prior nodes in run order). */
export function parseAgenticUpstream(upstream) {
  const chunks = String(upstream || "").split("\n\n").filter(Boolean);
  let lastText = null;
  let lastImage = null;
  let lastVideo = null;
  let lastAudio = null;
  let goal = "";

  for (const chunk of chunks) {
    const p = tryParseAgenticChunk(chunk);
    if (!p) {
      if (!goal && chunk.trim()) goal = chunk.trim();
      continue;
    }
    if (p.goal) goal = p.goal;
    if (p.agent === "text") lastText = p;
    if (p.agent === "image") lastImage = p;
    if (p.agent === "video") lastVideo = p;
    if (p.agent === "audio") lastAudio = p;
  }

  return { goal, lastText, lastImage, lastVideo, lastAudio };
}

function resolveGoal(node, upstream) {
  const { goal, lastText } = parseAgenticUpstream(upstream);
  if (goal) return goal;
  if (lastText?.content) return String(lastText.content).slice(0, 500);
  return String(upstream || node.data?.goal || node.data?.value || "").trim();
}

function priorForAgent(upstream, agentName) {
  const { lastText, lastImage } = parseAgenticUpstream(upstream);
  if (agentName === "image") return lastText ? { agent: "text", content: lastText.content, meta: lastText.meta } : null;
  if (agentName === "video") {
    if (lastImage) return { agent: "image", content: lastImage.content, meta: lastImage.meta };
    if (lastText) return { agent: "text", content: lastText.content, meta: lastText.meta };
    return null;
  }
  if (agentName === "audio") return lastText ? { agent: "text", content: lastText.content, meta: lastText.meta } : null;
  return null;
}

function imagesFromOutput(output) {
  const images = [];
  if (output.meta?.dataUrls?.length) {
    for (const dataUrl of output.meta.dataUrls) {
      if (dataUrl) images.push({ dataUrl });
    }
  } else if (Array.isArray(output.content)) {
    for (const item of output.content) {
      if (typeof item === "string" && item.startsWith("data:")) images.push({ dataUrl: item });
      else if (typeof item === "string" && item.length > 100) {
        images.push({ dataUrl: `data:image/jpeg;base64,${item}` });
      }
    }
  }
  return images;
}

function buildPayload(kind, goal, output, extra = {}) {
  return {
    kind,
    agent: output.agent,
    goal,
    content: output.content,
    meta: output.meta || {},
    ...extra,
  };
}

export async function executeAgenticTextNode(node, upstream) {
  const goal = resolveGoal(node, upstream);
  if (!goal) throw new Error("Text Agent needs a goal (connect Input or set goal in node)");

  const output = await runTextAgent(goal, EMPTY_MEMORY, null);
  const payload = buildPayload("agenticText", goal, output, {
    displayPreview: String(output.content || "").slice(0, 400),
  });

  return {
    output: formatAgenticNodeOutput(payload),
    displayOutput: String(output.content || "").slice(0, 2000),
    agenticPayload: payload,
    tokensUsed: Math.ceil(String(output.content).length / 4),
    creditsDeducted: node.data?.estimatedCredits ?? CREDITS.text,
  };
}

export async function executeAgenticImageNode(node, upstream) {
  const goal = resolveGoal(node, upstream);
  if (!goal) throw new Error("Image Agent needs upstream text or a goal");

  const prior = priorForAgent(upstream, "image");
  const imageGoal =
    node.data?.imageCount > 1
      ? `${goal}\n\nGenerate ${node.data.imageCount} key frame images from the script scenes.`
      : goal;

  const output = await runImageAgent(imageGoal, EMPTY_MEMORY, prior);
  const images = imagesFromOutput(output);
  const warning = images.length ? null : output.meta?.error || "No images generated";

  const payload = buildPayload("agenticImage", goal, output, {
    images,
    imageWarning: warning,
    displayPreview: images.length ? `${images.length} image(s) ready` : warning,
  });

  return {
    output: formatAgenticNodeOutput(payload),
    displayOutput: warning || `Generated ${images.length} image(s)`,
    agenticPayload: payload,
    tokensUsed: 800 * (images.length || 1),
    creditsDeducted: node.data?.estimatedCredits ?? CREDITS.image,
  };
}

export async function executeAgenticVideoNode(node, upstream) {
  const goal = resolveGoal(node, upstream);
  if (!goal) throw new Error("Video Agent needs upstream script or goal");

  const prior = priorForAgent(upstream, "video");
  const output = await runVideoAgent(goal, EMPTY_MEMORY, prior);
  const skipped = output.meta?.skipped;
  const error = output.meta?.error;

  const payload = buildPayload("agenticVideo", goal, output, {
    videoUri: output.content || null,
    videoNote: skipped ? output.meta?.reason : error || null,
    displayPreview: output.content
      ? `Video: ${output.content}`
      : skipped
        ? output.meta?.reason
        : error || "Video step finished",
  });

  return {
    output: formatAgenticNodeOutput(payload),
    displayOutput: payload.displayPreview,
    agenticPayload: payload,
    tokensUsed: skipped ? 0 : 1200,
    creditsDeducted: skipped ? 0 : node.data?.estimatedCredits ?? CREDITS.video,
  };
}

export async function executeAgenticAudioNode(node, upstream) {
  const goal = resolveGoal(node, upstream);
  if (!goal) throw new Error("Audio Agent needs upstream narration or goal");

  const prior = priorForAgent(upstream, "audio");
  let output;
  try {
    output = await runAudioAgent(goal, EMPTY_MEMORY, prior);
  } catch (err) {
    const payload = buildPayload(
      "agenticAudio",
      goal,
      { agent: "audio", content: null, meta: { error: err.message } },
      { audio: null, audioWarning: err.message, displayPreview: err.message }
    );
    return {
      output: formatAgenticNodeOutput(payload),
      displayOutput: `TTS failed: ${err.message}`,
      agenticPayload: payload,
      tokensUsed: 0,
      creditsDeducted: 0,
    };
  }

  let audio = null;
  if (typeof output.content === "string" && fs.existsSync(output.content)) {
    audio = { mimeType: "audio/wav", tempPath: output.content };
  }

  const { lastVideo } = parseAgenticUpstream(upstream);
  let integratedVideo = null;
  let videoUri = lastVideo?.videoUri || lastVideo?.content || null;
  let muxWarning = null;
  if (videoUri && audio) {
    try {
      const muxed = await muxVideoWithAudio({
        video: videoUri,
        audio,
        label: "workflow_agentic_video",
      });
      if (muxed.ok) {
        integratedVideo = { mimeType: muxed.mimeType, tempPath: muxed.path };
        videoUri = muxed.path;
      } else {
        muxWarning = muxed.reason;
      }
    } catch (err) {
      muxWarning = `Could not combine video and audio: ${err.message}`;
    }
  }

  const payload = buildPayload("agenticAudio", goal, output, {
    audio,
    videoUri,
    integratedVideo,
    audioIntegrated: Boolean(integratedVideo),
    muxWarning,
    displayPreview: integratedVideo
      ? "Integrated video with voiceover ready"
      : audio
        ? "Voiceover audio ready"
        : "No audio data",
  });

  return {
    output: formatAgenticNodeOutput(payload),
    displayOutput: payload.displayPreview,
    agenticPayload: payload,
    tokensUsed: 400,
    creditsDeducted: node.data?.estimatedCredits ?? CREDITS.audio,
  };
}

export async function executeAgenticCodeNode(node, upstream) {
  const goal = resolveGoal(node, upstream);
  if (!goal) throw new Error("Code Agent needs a task description");

  const output = await runCodeAgent(goal);
  const payload = buildPayload("agenticCode", goal, output, {
    code: output.meta?.code,
    displayPreview: String(output.content || "").slice(0, 500),
  });

  return {
    output: formatAgenticNodeOutput(payload),
    displayOutput: String(output.content || "").slice(0, 1500),
    agenticPayload: payload,
    tokensUsed: Math.ceil(String(output.meta?.code || "").length / 4),
    creditsDeducted: node.data?.estimatedCredits ?? CREDITS.code,
  };
}

export const AGENTIC_NODE_TYPES = {
  agenticText: executeAgenticTextNode,
  agenticImage: executeAgenticImageNode,
  agenticVideo: executeAgenticVideoNode,
  agenticAudio: executeAgenticAudioNode,
  agenticCode: executeAgenticCodeNode,
};
