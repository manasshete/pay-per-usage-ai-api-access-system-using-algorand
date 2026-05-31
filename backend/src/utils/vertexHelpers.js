/** Shared Vertex AI helpers for Imagen / Veo agents. */

export function isVertexPermissionError(message = "") {
  const m = String(message).toLowerCase();
  return (
    m.includes("permission denied") ||
    m.includes("iam_permission_denied") ||
    m.includes("aiplatform.endpoints.predict") ||
    m.includes("403")
  );
}

export function veoOutputStorageUri() {
  const bucket = (process.env.GCS_ASSETS_BUCKET || "").trim();
  if (!bucket) return null;
  const prefix = (process.env.GCS_ASSET_PREFIX || "sentinal").replace(/^\/|\/$/g, "");
  return `gs://${bucket}/${prefix}/veo-output/`;
}

export function getVeoModelIds() {
  const fromEnv = (process.env.VEO_MODEL_IDS || "").trim();
  if (fromEnv) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    "veo-3.1-fast-generate-001",
    "veo-3.0-fast-generate-001",
    "veo-2.0-generate-001",
  ];
}

export const VEO_ALLOWLIST_HELP =
  "Veo requires GCP project allowlist access. In Google Cloud Console go to Vertex AI → Model Garden → search Veo → Request access. Also grant your service account roles/aiplatform.user and set GCS_ASSETS_BUCKET for video output.";

export const IMAGEN_PERMISSION_HELP =
  "Vertex Imagen denied. Images will use Gemini (GOOGLE_API_KEY). To use Imagen set VERTEX_IMAGEN_ENABLED=true and grant roles/aiplatform.user on the service account.";
