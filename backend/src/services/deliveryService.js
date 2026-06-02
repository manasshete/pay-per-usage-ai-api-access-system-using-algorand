import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  isGcsConfigured,
  publishAgenticPayloadToGcs,
  resolveGcsUri,
} from "./gcsAssetService.js";
import { muxVideoWithAudio } from "./mediaComposer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR =
  process.env.PIPELINE_OUTPUT_DIR ||
  path.join(__dirname, "..", "..", "outputs", "pipeline");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function saveAudioLocal(tmpPath, runId) {
  if (!tmpPath || !fs.existsSync(tmpPath)) return null;
  const filename = `audio_${runId}.wav`;
  const destPath = path.join(OUTPUT_DIR, filename);
  fs.copyFileSync(tmpPath, destPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore */
  }
  return `/outputs/pipeline/${filename}`;
}

function saveImagesLocal(b64Array, runId) {
  if (!Array.isArray(b64Array)) return [];
  return b64Array
    .filter((x) => typeof x === "string" && !x.startsWith("http"))
    .map((b64, i) => {
      const filename = `image_${runId}_${i}.jpg`;
      const destPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(destPath, Buffer.from(b64, "base64"));
      return `/outputs/pipeline/${filename}`;
    });
}

function saveIntegratedVideoLocal(tmpPath, runId) {
  if (!tmpPath || !fs.existsSync(tmpPath)) return null;
  const filename = `video_integrated_${runId}.mp4`;
  const destPath = path.join(OUTPUT_DIR, filename);
  fs.copyFileSync(tmpPath, destPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore */
  }
  return `/outputs/pipeline/${filename}`;
}

export async function deliver(run, outputs) {
  const runId = run._id.toString();
  const deliveryPackage = {
    runId,
    createdAt: run.createdAt,
    inputs: { text: run.inputText, imagePath: run.imagePath || null },
    chain: run.chain,
    results: [],
    storage: isGcsConfigured() ? "gcs" : "local",
  };

  for (const output of outputs) {
    const working = { ...output, meta: { ...(output.meta || {}) } };

    if (isGcsConfigured() && ["image", "audio", "video"].includes(working.agent)) {
      await publishAgenticPayloadToGcs(working, {
        scope: "pipeline",
        runId,
        nodeId: working.agent,
      });
      working.meta.gcs = true;
    }

    const entry = { agent: working.agent, meta: working.meta };

    switch (working.agent) {
      case "text":
        entry.content = working.content;
        entry.contentType = "text/plain";
        break;
      case "image": {
        if (Array.isArray(working.content) && working.content.every((u) => typeof u === "string" && u.startsWith("http"))) {
          entry.content = working.content;
        } else if (working.meta?.dataUrls?.length) {
          entry.content = working.meta.dataUrls;
        } else {
          entry.content = saveImagesLocal(working.content, runId);
          working.content = entry.content;
        }
        entry.contentType = "image/jpeg";
        break;
      }
      case "audio": {
        if (typeof working.content === "string" && working.content.startsWith("http")) {
          entry.content = working.content;
        } else {
          entry.content = await saveAudioLocal(working.content, runId);
          if (entry.content) working.content = entry.content;
        }
        entry.contentType = "audio/wav";
        break;
      }
      case "video": {
        entry.content = isGcsConfigured()
          ? await resolveGcsUri(working.content)
          : working.content;
        working.content = entry.content;
        entry.contentType = "video/mp4";
        if (working.meta?.skipped || working.meta?.error) {
          entry.note = working.meta.reason || working.meta.error;
        }
        break;
      }
      case "code":
        entry.content = working.content;
        entry.code = working.meta?.code;
        entry.contentType = "text/plain";
        break;
      default:
        entry.content = working.content;
    }

    deliveryPackage.results.push(entry);
    Object.assign(output, working);
  }

  const videoEntry = deliveryPackage.results.find((r) => r.agent === "video" && r.content);
  const audioEntry = deliveryPackage.results.find((r) => r.agent === "audio" && r.content);
  if (videoEntry && audioEntry) {
    try {
      const muxed = await Promise.race([
        muxVideoWithAudio({
          video: videoEntry.content,
          audio: audioEntry.content,
          label: "pipeline_agentic_video",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Video/audio mux timed out")), 95_000)
        ),
      ]);
      if (muxed.ok) {
        let integratedUrl = null;
        if (isGcsConfigured()) {
          const payload = {
            agent: "video",
            kind: "agenticVideo",
            content: videoEntry.content,
            videoUri: videoEntry.content,
            integratedVideo: { tempPath: muxed.path, mimeType: "video/mp4" },
          };
          await publishAgenticPayloadToGcs(payload, {
            scope: "pipeline",
            runId,
            nodeId: "video",
          });
          integratedUrl = payload.videoUri;
        } else {
          integratedUrl = saveIntegratedVideoLocal(muxed.path, runId);
        }
        if (integratedUrl) {
          videoEntry.content = integratedUrl;
          videoEntry.meta = {
            ...(videoEntry.meta || {}),
            audioIntegrated: true,
            audioUrl: audioEntry.content,
          };
          audioEntry.meta = {
            ...(audioEntry.meta || {}),
            integratedIntoVideo: true,
          };
          const videoOutput = outputs.find((o) => o.agent === "video");
          if (videoOutput) {
            videoOutput.content = integratedUrl;
            videoOutput.meta = {
              ...(videoOutput.meta || {}),
              audioIntegrated: true,
              audioUrl: audioEntry.content,
            };
          }
          const audioOutput = outputs.find((o) => o.agent === "audio");
          if (audioOutput) {
            audioOutput.meta = {
              ...(audioOutput.meta || {}),
              integratedIntoVideo: true,
            };
          }
        }
      } else {
        videoEntry.note = muxed.reason;
      }
    } catch (err) {
      videoEntry.note = `Video generated, but audio integration failed: ${err.message}`;
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, `manifest_${runId}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(deliveryPackage, null, 2));

  return `/api/studio/agentic/runs/${runId}`;
}

export { OUTPUT_DIR };
