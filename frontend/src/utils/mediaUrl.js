import { assetUrl } from "../api/agenticPipeline.js";

/** Resolve local paths, GCS signed URLs, or data URLs for img/audio/video. */
export function mediaSrc(src) {
  if (!src) return null;
  if (typeof src === "object") {
    if (src.url) return mediaSrc(src.url);
    if (src.dataUrl) return src.dataUrl;
    return null;
  }
  const s = String(src);
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
  return assetUrl(s);
}
