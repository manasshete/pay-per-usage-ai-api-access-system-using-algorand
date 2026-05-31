import { describe, expect, it } from "vitest";
import { mapHttpError, SentinelAuthError, SentinelSessionExpired } from "./errors.js";
import { SentinelClient } from "./SentinelClient.js";

describe("mapHttpError", () => {
  it("maps 401 to SentinelAuthError", () => {
    const err = mapHttpError(401, { error: "Invalid API key" });
    expect(err).toBeInstanceOf(SentinelAuthError);
    expect(err.message).toBe("Invalid API key");
  });

  it("maps 410 to SentinelSessionExpired", () => {
    const err = mapHttpError(410, { error: "Payment session expired or unknown" });
    expect(err).toBeInstanceOf(SentinelSessionExpired);
  });
});

describe("SentinelClient message normalization", () => {
  it("requires messages or prompt", async () => {
    const client = new SentinelClient({
      apiKey: "sk-sentinel-test",
      baseUrl: "http://localhost:5000",
    });

    await expect(client.invoke([], {})).rejects.toThrow(/messages or opts.prompt/);
  });
});
