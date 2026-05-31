import { api, getApiBase } from "./client.js";

const BASE = "/api/studio/agentic";

function authHeaders() {
  const token = localStorage.getItem("sentinal_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const base = getApiBase();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function streamPipelineRun(inputText, imageFile, { onProgress, onComplete, onError }) {
  const formData = new FormData();
  formData.append("inputText", inputText);
  if (imageFile) formData.append("image", imageFile);

  fetch(`${getApiBase()}${BASE}/run`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((d) => {
          throw new Error(d.error || `HTTP ${response.status}`);
        });
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";
            for (const part of parts) {
              const line = part.replace(/^data:\s*/, "").trim();
              if (!line || line.startsWith(":")) continue;
              try {
                const event = JSON.parse(line);
                if (event.type === "progress") onProgress?.(event);
                if (event.type === "complete") onComplete?.(event);
                if (event.type === "error") onError?.(event.message);
              } catch {
                /* ignore */
              }
            }
            read();
          })
          .catch(onError);
      }
      read();
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
