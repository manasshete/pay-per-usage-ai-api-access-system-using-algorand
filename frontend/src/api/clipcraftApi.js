import { api } from "./client.js";
import { studioFetch } from "./studioFetch.js";

export async function getClipCraftHealth() {
  const { data } = await api.get("/api/studio/clipcraft/health");
  return data;
}

export async function listClipJobs() {
  const { data } = await api.get("/api/studio/clipcraft/jobs");
  return data.jobs ?? [];
}

export async function getClipJob(jobId) {
  const { data } = await api.get(`/api/studio/clipcraft/jobs/${jobId}`);
  return data.job;
}

export async function submitClipJob({ url, tier, packCount, idempotencyKey }) {
  const res = await studioFetch("/api/studio/clipcraft/jobs", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { url, tier, packCount },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return await res.json();
}

const TERMINAL = new Set(["ready", "failed"]);

export function isClipJobDone(status) {
  return TERMINAL.has(status);
}

/** Poll until ready or failed */
export async function pollClipJob(jobId, { intervalMs = 800, timeoutMs = 120000, onUpdate } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getClipJob(jobId);
    onUpdate?.(job);
    if (isClipJobDone(job.status)) return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Clip generation timed out — check Render Queue or try again.");
}
