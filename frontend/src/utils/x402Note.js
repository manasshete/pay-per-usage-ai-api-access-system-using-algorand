/** On-chain note for marketplace x402 payments: x402:sentinel:<serviceId> */
export function buildX402SentinelNote(serviceId) {
  const id = String(serviceId || "").trim();
  if (!id) throw new Error("serviceId required for x402 payment note");
  return `x402:sentinel:${id}`;
}
