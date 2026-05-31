import { geminiGenerateContent } from "../../utils/geminiRest.js";

export async function runTextAgent(inputText, memory, priorOutput = null) {
  const prefStr =
    Object.entries(memory.preferences || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "none";
  const context = memory.pastChunks?.join("\n") || "No prior context.";

  const system = `You are an expert content writer and researcher.
User preferences: ${prefStr}.
For video / launch / promo scripts you MUST use this exact plain-text format (no markdown headers):
SCENE 1: [one-line visual for image generation] | NARRATION: [voiceover line]
SCENE 2: [one-line visual] | NARRATION: [voiceover line]
SCENE 3: [one-line visual] | NARRATION: [voiceover line]
Keep each SCENE visual concise (under 200 chars) and concrete for AI image generation.`;

  let userMsg = `Task: ${inputText}\n\nMemory:\n${context}`;
  if (priorOutput) {
    userMsg += `\n\nPrevious output:\n${String(priorOutput.content).slice(0, 500)}`;
  }

  const { text } = await geminiGenerateContent("gemini-2.5-flash", {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  });

  return {
    agent: "text",
    content: text,
    meta: { model: "gemini-2.5-flash" },
  };
}
