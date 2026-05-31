export function getGeminiApiKey() {
  const key = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!key) throw new Error("GOOGLE_API_KEY is not set on the server");
  return key;
}

export async function geminiGenerateContent(model, body) {
  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText || "Gemini request failed");
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { data, text };
}

export async function geminiEmbed(text) {
  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Embedding failed");
  return data.embedding?.values || data.embedding?.value || [];
}
