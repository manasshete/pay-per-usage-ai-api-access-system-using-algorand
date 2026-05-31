import fs from "fs";
import path from "path";
import os from "os";
import { getGeminiApiKey } from "../../utils/geminiRest.js";
import { extractNarrationFromScript } from "../../utils/scriptSceneParser.js";
import { ttsInlineToPlayableBuffer } from "../../utils/pcmToWav.js";

export async function runAudioAgent(inputText, memory, priorOutput = null) {
  let narration = inputText;
  if (priorOutput?.agent === "text") {
    const fromScript = extractNarrationFromScript(priorOutput.content);
    if (fromScript) narration = fromScript;
  }

  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: narration.slice(0, 4000) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "TTS generation failed");
  }

  const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) {
    throw new Error("TTS returned no audio data");
  }

  const { buffer, ext, mimeType } = ttsInlineToPlayableBuffer(inline);
  const filePath = path.join(os.tmpdir(), `tts_${Date.now()}.${ext}`);
  fs.writeFileSync(filePath, buffer);

  return {
    agent: "audio",
    content: filePath,
    meta: {
      model: "gemini-2.5-flash-tts",
      voice: "Kore",
      mimeType,
      bytes: buffer.length,
    },
  };
}
