# Error Handling — @sentinel-ai/sdk

The SDK throws typed error subclasses so you can handle specific failure modes cleanly.

## Error Hierarchy

```
SentinelError (base)
├── SentinelAuthError        (HTTP 401/403 — bad or missing API key)
├── SentinelPaymentError     (HTTP 402 — payment not verified)
├── SentinelSessionExpired   (HTTP 410 — paymentRef TTL expired, re-invoke needed)
├── SentinelUpstreamError    (HTTP 502/503 — upstream AI provider failed)
└── SentinelNetworkError     (network timeout or fetch failure)
```

## Usage

```ts
import {
  SentinelClient,
  SentinelAuthError,
  SentinelPaymentError,
  SentinelSessionExpired,
  SentinelUpstreamError,
  SentinelNetworkError,
} from "@sentinel-ai/sdk";

try {
  const response = await client.chat(messages, signer);
  console.log(SentinelClient.getAssistantText(response));
} catch (err) {
  if (err instanceof SentinelAuthError) {
    console.error("Invalid API key — regenerate from the marketplace.");
  } else if (err instanceof SentinelSessionExpired) {
    // paymentRef TTL is 60 seconds — retry the whole chat() call
    console.error("Session expired. Retrying...");
    // await client.chat(messages, signer);
  } else if (err instanceof SentinelPaymentError) {
    console.error("Payment could not be verified:", err.message);
  } else if (err instanceof SentinelUpstreamError) {
    console.error("AI provider is temporarily unavailable:", err.message);
  } else if (err instanceof SentinelNetworkError) {
    console.error("Network error:", err.message);
  } else {
    throw err; // rethrow unknown errors
  }
}
```

## Error Properties

All `SentinelError` subclasses expose:

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable description |
| `status` | `number \| undefined` | HTTP status code (if from API) |
| `body` | `ApiErrorBody \| undefined` | Parsed JSON error body from API |
| `cause` | `unknown` | Underlying error (for network errors) |

## Session Expiry

The most common recoverable error is `SentinelSessionExpired` (HTTP 410).

The server caches the AI response for **60 seconds** after `invoke()`. If your wallet signing flow takes longer (e.g., user dismissed the Pera popup), simply call `client.chat()` again.

```ts
async function chatWithRetry(messages, signer, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.chat(messages, signer);
    } catch (err) {
      if (err instanceof SentinelSessionExpired && i < maxRetries - 1) continue;
      throw err;
    }
  }
}
```
