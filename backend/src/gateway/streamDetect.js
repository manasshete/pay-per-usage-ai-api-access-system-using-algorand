export function wantsStream(req) {
  if (req.method !== "POST" && req.method !== "PUT") return false;
  if (req.body?.stream === true) return true;
  const accept = String(req.headers.accept || "").toLowerCase();
  return accept.includes("text/event-stream");
}
