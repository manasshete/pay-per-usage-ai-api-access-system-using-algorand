/** Single Algorand node URL for wallet signing, burner, and Studio payments. */
export function getDefaultAlgodServer() {
  return (
    import.meta.env.VITE_ALGORAND_NODE ||
    import.meta.env.VITE_ALGO_NODE_URL ||
    import.meta.env.VITE_ALGOD_SERVER ||
    "https://testnet-api.algonode.cloud"
  )
    .trim()
    .replace(/\/$/, "");
}
