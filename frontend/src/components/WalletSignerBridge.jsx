import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useWalletLogin } from "../context/PeraLoginContext.jsx";
import {
  registerWalletSigner,
  clearWalletSigner,
} from "../wallet/walletSignerBridge.js";
import { normalizeAccountAddress } from "../wallet/pera.js";

/** Injects use-wallet signers into non-React payment helpers. */
export default function WalletSignerBridge() {
  const {
    signTransactions,
    signData,
    activeAddress,
    activeWallet,
    isReady,
  } = useWallet();
  const { openConnectModal } = useWalletLogin();

  useEffect(() => {
    if (!isReady) return;

    registerWalletSigner({
      signTransactions,
      getActiveAddress: () => activeAddress,
      getActiveWalletName: () => activeWallet?.metadata?.name || activeWallet?.id || "Wallet",
      openConnectModal,
      signData: async (messageBytes, address) => {
        if (typeof signData !== "function") {
          throw new Error("Connected wallet does not support message signing.");
        }
        const signer = normalizeAccountAddress(address) || activeAddress;
        if (!signer) {
          throw new Error("No active wallet address for login signing.");
        }
        return signData(
          [{ data: messageBytes, message: "Sign in to SentinelAI" }],
          signer
        );
      },
    });

    return () => clearWalletSigner();
  }, [
    signTransactions,
    signData,
    activeAddress,
    activeWallet,
    isReady,
    openConnectModal,
  ]);

  return null;
}
