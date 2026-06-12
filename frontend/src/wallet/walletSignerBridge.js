/**
 * Bridge between use-wallet React hooks and plain JS payment modules.
 * Registered once by WalletSignerBridge.jsx inside WalletProvider.
 */

let bridge = null;

export function registerWalletSigner(api) {
  bridge = api;
}

export function clearWalletSigner() {
  bridge = null;
}

export function getWalletSigner() {
  return bridge;
}
