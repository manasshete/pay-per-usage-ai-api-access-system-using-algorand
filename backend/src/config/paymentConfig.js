/** Public payment destination — safe to expose to the frontend (Algorand address only). */
export function getPublicReceiverWallet() {
  return (
    process.env.RECEIVER_WALLET?.trim() ||
    process.env.SENTINEL_WALLET_ADDRESS?.trim() ||
    process.env.TREASURY_WALLET?.trim() ||
    ""
  );
}

/** @deprecated Use getPublicReceiverWallet — same resolution order. */
export const getSentinelWallet = getPublicReceiverWallet;
