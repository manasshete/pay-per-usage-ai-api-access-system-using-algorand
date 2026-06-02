import { studioFetch } from "./studioFetch.js";
import { api, getApiBase } from "./client.js";

const BASE = "/api/studio/agentic";

export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const base = getApiBase();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseSseChunk(raw, handlers) {
  const line = raw.replace(/^data:\s*/m, "").trim();
  if (!line || line.startsWith(":")) return false;
  try {
    const event = JSON.parse(line);
    if (event.type === "progress") handlers.onProgress?.(event);
    if (event.type === "complete") {
      handlers.onComplete?.(event);
      return true;
    }
    if (event.type === "error") handlers.onError?.(event.message);
  } catch {
    /* ignore */
  }
  return false;
}

function drainSseBuffer(buffer, handlers) {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";
  let completed = false;
  for (const part of parts) {
    if (parseSseChunk(part, handlers)) completed = true;
  }
  return { remainder, completed };
}

function consumeSseStream(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamCompleted = false;
  const wrapped = {
    ...handlers,
    onComplete: (event) => {
      streamCompleted = true;
      handlers.onComplete?.(event);
    },
  };

  function read() {
    reader
      .read()
      .then(({ done, value }) => {
        if (value) buffer += decoder.decode(value, { stream: !done });
        const drained = drainSseBuffer(buffer, wrapped);
        buffer = drained.remainder;
        if (drained.completed) streamCompleted = true;
        if (done) {
          if (buffer.trim()) {
            const final = drainSseBuffer(`${buffer}\n\n`, wrapped);
            if (final.completed) streamCompleted = true;
          }
          if (!streamCompleted) {
            handlers.onError?.(
              "Stream ended before delivery finished. Check Run History — your outputs may still be there."
            );
          }
          return;
        }
        read();
      })
      .catch(handlers.onError);
  }
  read();
}

export function streamPipelineRun(inputText, imageFile, { runType = "agentic_text", onProgress, onComplete, onError }) {
  const formData = new FormData();
  formData.append("inputText", inputText);
  formData.append("runType", runType);
  if (imageFile) formData.append("image", imageFile);

  studioFetch(`${BASE}/run`, { method: "POST", body: formData })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((d) => {
          throw new Error(d.error || `HTTP ${response.status}`);
        });
      }
      consumeSseStream(response, { onProgress, onComplete, onError });
    })
    .catch(onError);
}

export async function fetchPipelineRuns() {
  const { data } = await api.get(`${BASE}/runs`);
  return data.runs || [];
}

export async function fetchPipelineRun(id) {
  const { data } = await api.get(`${BASE}/runs/${id}`);
  return data.run;
}
