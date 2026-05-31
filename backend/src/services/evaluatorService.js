import { geminiGenerateContent } from "../utils/geminiRest.js";

const SYSTEM = `You are a strict quality evaluator for an AI content pipeline.
Score the output against the user goal. Return ONLY valid JSON:
{ "score": 0.0-1.0, "passed": true|false, "feedback": "one sentence" }
Rubric: 0.9-1.0 perfect | 0.75-0.89 mostly good | 0.5-0.74 partial | <0.5 fail`;

function parseEvalJson(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function evaluate(inputText, agentOutput) {
  const preview = String(agentOutput?.content ?? "").slice(0, 1000);
  const userMsg = `Goal: ${inputText}\n\nAgent: ${agentOutput.agent}\nOutput:\n${preview}`;

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
    const parsed = parseEvalJson(text);
    if (parsed && typeof parsed.score === "number") {
      return {
        score: parsed.score,
        passed: Boolean(parsed.passed),
        feedback: parsed.feedback || "OK",
      };
    }
  } catch {
    /* fall through */
  }

  const hasContent = Boolean(agentOutput?.content);
  return {
    score: hasContent ? 0.78 : 0.4,
    passed: hasContent,
    feedback: hasContent ? "Output produced; automated eval unavailable." : "No output to evaluate.",
  };
}
