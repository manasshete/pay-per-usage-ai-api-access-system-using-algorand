import { geminiGenerateContent } from "../utils/geminiRest.js";

const VALID_AGENTS = new Set(["text", "image", "video", "audio", "code"]);
const ORDER = ["text", "image", "video", "audio", "code"];

const SYSTEM = `You are an intent router for a multimodal AI pipeline.
Given a user request and memory context, return ONLY valid JSON:
{
  "chain": ["text"|"image"|"video"|"audio"|"code"],
  "parallel": false,
  "priority": "text"|"image"|"video"|"audio"|"code"
}
Rules:
- video / promo / trailer / cinematic ad → chain: ["text","image","video"] or add "audio" if voiceover requested
- keyframe images / generate N images → chain: ["text","image"]
- launch script + images + narrate → chain: ["text","image","audio"]
- research/write only → chain: ["text"]
- code/automate → chain: ["code"]
- podcast/voice → chain: ["text","audio"]`.trim();

/** Keyword fallback when the LLM returns text-only for a multimodal request. */
export function inferChainFromPrompt(inputText, llmDecision = {}) {
  const t = String(inputText || "").toLowerCase();
  const llmChain = (llmDecision?.chain || []).filter((a) => VALID_AGENTS.has(a));

  const wantsImage =
    /\b(images?|key\s*frames?|keyframes?|thumbnail|visuals?|pictures?|frames?)\b/.test(t) ||
    /\bgenerate\s+\d+\b/.test(t);
  const wantsVideo =
    /\b(video|veo|promo\s*video|trailer|reel|clip|animate|motion)\b/.test(t) ||
    (/\bcinematic\b/.test(t) &&
      /\b(launch|promo|ad|advert|fitness|app)\b/.test(t) &&
      !/\b(script\s+only|write\s+only|blog)\b/.test(t));
  const wantsAudio = /\b(narrat|voice\s*over|voiceover|tts|speak|audio|podcast)\b/.test(t);
  const wantsCode =
    /\b(python|automate|data\s+processing)\b/.test(t) &&
    !wantsImage &&
    !wantsVideo &&
    !wantsAudio;

  if (wantsCode && !wantsImage && !wantsVideo && !wantsAudio) {
    return { chain: ["code"], parallel: false, priority: "code" };
  }

  const merged = new Set(["text"]);
  if (wantsImage || wantsVideo || llmChain.includes("image") || llmChain.includes("video")) {
    merged.add("image");
  }
  if (wantsVideo || llmChain.includes("video")) merged.add("video");
  if (wantsAudio || llmChain.includes("audio")) merged.add("audio");
  for (const a of llmChain) merged.add(a);

  const chain = ORDER.filter((a) => merged.has(a));
  const priority = llmDecision?.priority && merged.has(llmDecision.priority)
    ? llmDecision.priority
    : chain[chain.length - 1] || "text";

  return { chain, parallel: false, priority };
}

export async function routeIntent(inputText, memoryContext) {
  const contextStr = memoryContext.pastChunks?.join("\n") || "No prior context.";
  const userMsg = `User request: ${inputText}\n\nMemory:\n${contextStr}`;

  let llmDecision = { chain: ["text"], parallel: false, priority: "text" };
  try {
    const { text } = await geminiGenerateContent("gemini-2.0-flash", {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
    llmDecision = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    /* use keyword fallback */
  }

  return inferChainFromPrompt(inputText, llmDecision);
}
