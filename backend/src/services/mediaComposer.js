import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, "..", "..");

async function getFfmpegPath() {
  if (process.env.FFMPEG_PATH?.trim()) return process.env.FFMPEG_PATH.trim();
  try {
    const mod = await import("ffmpeg-static");
    return mod.default || mod.path || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

function extFromMimeOrUrl(value, fallback) {
  const raw = String(value || "").split("?")[0].toLowerCase();
  if (raw.endsWith(".mp4")) return "mp4";
  if (raw.endsWith(".mov")) return "mov";
  if (raw.endsWith(".webm")) return "webm";
  if (raw.endsWith(".mp3")) return "mp3";
  if (raw.endsWith(".wav")) return "wav";
  return fallback;
}

function localPathFromOutputUrl(url) {
  const raw = String(url || "");
  if (!raw.startsWith("/outputs/")) return null;
  return path.join(BACKEND_ROOT, raw.replace(/^\/outputs\//, "outputs/"));
}

async function materializeAsset(ref, fallbackExt) {
  const raw = typeof ref === "string" ? ref : ref?.url || ref?.content || "";
  if (!raw) return null;

  const localOutput = localPathFromOutputUrl(raw);
  if (localOutput && fs.existsSync(localOutput)) return localOutput;
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return fs.existsSync(raw) ? raw : null;
  }

  const res = await fetch(raw, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Failed to download media for mux (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(
    os.tmpdir(),
    `mux_${Date.now()}_${Math.random().toString(36).slice(2)}.${extFromMimeOrUrl(raw, fallbackExt)}`
  );
  await fs.promises.writeFile(filePath, buf);
  return filePath;
}

const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_MUX_TIMEOUT_MS) || 90_000;

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000}s`));
    }, FFMPEG_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.split("\n").slice(-8).join("\n").trim() || `ffmpeg exited ${code}`));
    });
  });
}

export async function muxVideoWithAudio({ video, audio, label = "integrated" }) {
  const videoPath = await materializeAsset(video, "mp4");
  const audioPath = await materializeAsset(audio, "wav");
  if (!videoPath || !audioPath) {
    return { ok: false, reason: "Video or audio asset was not available for muxing." };
  }

  const ffmpegPath = await getFfmpegPath();
  const outPath = path.join(
    os.tmpdir(),
    `${label}_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  );

  await runFfmpeg(ffmpegPath, [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    outPath,
  ]);

  return {
    ok: true,
    path: outPath,
    mimeType: "video/mp4",
  };
}
