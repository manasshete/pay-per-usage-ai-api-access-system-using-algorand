/**
 * Vertex AI auth: service account (Imagen/Veo) or API key (?key=) when no ADC.
 * Express mode keys from Vertex AI Studio go in VERTEX_API_KEY.
 */

export function getVertexApiKey() {
  return (process.env.VERTEX_API_KEY || process.env.VERTEX_AI_API_KEY || "").trim();
}

export async function getVertexBearerToken() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credsPath) return null;

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResult = await client.getAccessToken();
    return tokenResult.token || null;
  } catch (err) {
    console.warn("[vertex] ADC token failed:", err.message?.slice(0, 120));
    return null;
  }
}

export function withVertexApiKey(url) {
  const key = getVertexApiKey();
  if (!key) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}key=${encodeURIComponent(key)}`;
}

/**
 * @returns {{ headers: Record<string,string>, authMode: 'bearer'|'api_key'|'none' }}
 */
export async function getVertexRequestAuth() {
  const token = await getVertexBearerToken();
  if (token) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      authMode: "bearer",
    };
  }

  const key = getVertexApiKey();
  if (key) {
    return {
      headers: { "Content-Type": "application/json" },
      authMode: "api_key",
    };
  }

  return {
    headers: { "Content-Type": "application/json" },
    authMode: "none",
  };
}

export async function vertexFetch(url, init = {}) {
  const { headers, authMode } = await getVertexRequestAuth();
  const finalUrl = authMode === "api_key" ? withVertexApiKey(url) : url;

  if (authMode === "none") {
    throw new Error(
      "Vertex AI auth missing. Set GOOGLE_APPLICATION_CREDENTIALS (service account JSON) or VERTEX_API_KEY (from Vertex AI Studio)."
    );
  }

  return fetch(finalUrl, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
}
