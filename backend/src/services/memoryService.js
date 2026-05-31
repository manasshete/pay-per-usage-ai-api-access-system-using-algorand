import { UserMemory } from "../models/UserMemory.js";
import { geminiEmbed, geminiGenerateContent } from "../utils/geminiRest.js";

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

async function extractPreferences(chunks) {
  if (!chunks.length) return {};
  try {
    const { text } = await geminiGenerateContent("gemini-2.0-flash", {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract user style preferences as JSON from these notes. Return ONLY valid JSON like {"colorPalette":"dark","style":"minimal","tone":"cinematic"}.\n\nNotes:\n${chunks.join("\n")}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return {};
  }
}

export async function fetchMemory(userId, queryText, k = 5) {
  let queryVec = [];
  try {
    queryVec = await geminiEmbed(queryText);
  } catch (err) {
    console.warn("[agentic memory] embedding fetch skipped:", err.message);
    return { pastChunks: [], preferences: {} };
  }

  const all = await UserMemory.find({ userId }).lean();
  if (!all.length) return { pastChunks: [], preferences: {} };

  const scored = all
    .map((m) => ({ ...m, score: cosine(queryVec, m.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const pastChunks = scored.map((m) => m.text);
  const preferences = await extractPreferences(pastChunks);
  return { pastChunks, preferences };
}

export async function writeMemory(userId, summaryText) {
  try {
    const embedding = await geminiEmbed(summaryText);
    await UserMemory.create({ userId, text: summaryText, embedding });
  } catch (err) {
    console.warn("[agentic memory] memory write skipped:", err.message);
  }
}
