export function gatewayError(res, status, code, message, extra = {}) {
  return res.status(status).json({
    error: code,
    message,
    requestId: extra.requestId ?? null,
    balance: extra.balance ?? undefined,
    estimatedCost: extra.estimatedCost ?? undefined,
    depositUrl: extra.depositUrl ?? process.env.GATEWAY_DEPOSIT_URL ?? undefined,
    ...extra.fields,
  });
}
