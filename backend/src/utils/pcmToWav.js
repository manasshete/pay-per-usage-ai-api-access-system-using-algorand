/**
 * Gemini TTS returns raw L16 PCM (e.g. audio/L16;codec=pcm;rate=24000), not a WAV file.
 * Browsers need a RIFF WAV header to play or download.
 */
export function parsePcmParamsFromMime(mimeType = "") {
  const m = String(mimeType || "");
  const rateMatch = m.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24_000;
  const channels = /channels=2/i.test(m) ? 2 : 1;
  return { sampleRate, channels, bitsPerSample: 16 };
}

export function isLikelyPcmMime(mimeType = "") {
  const m = String(mimeType || "").toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3") || m.includes("ogg") || m.includes("wav")) {
    return false;
  }
  return m.includes("l16") || m.includes("pcm") || m.includes("linear16") || !m;
}

export function pcmToWav(pcmBuffer, { sampleRate = 24_000, channels = 1, bitsPerSample = 16 } = {}) {
  const pcm = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer);
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

export function ttsInlineToPlayableBuffer(inlineData) {
  const mime = inlineData?.mimeType || "";
  const raw = Buffer.from(inlineData.data, "base64");

  if (!isLikelyPcmMime(mime)) {
    return { buffer: raw, ext: mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "wav", mimeType: mime || "audio/wav" };
  }

  const params = parsePcmParamsFromMime(mime);
  return {
    buffer: pcmToWav(raw, params),
    ext: "wav",
    mimeType: "audio/wav",
  };
}
