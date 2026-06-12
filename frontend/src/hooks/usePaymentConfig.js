import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { setCachedReceiverWallet } from "../api/studioOverage.js";
import { getDefaultAlgodServer } from "../utils/algodConfig.js";

const ENV_RECEIVER =
  import.meta.env.VITE_RECEIVER_WALLET?.trim() ||
  import.meta.env.VITE_SENTINEL_WALLET_ADDRESS?.trim() ||
  "";

export function usePaymentConfig() {
  const [config, setConfig] = useState({
    algodServer: getDefaultAlgodServer(),
    receiverWallet: ENV_RECEIVER,
    loading: !ENV_RECEIVER,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/public/network")
      .then(({ data }) => {
        if (cancelled) return;
        const receiverWallet = data?.receiverWallet?.trim() || ENV_RECEIVER;
        if (receiverWallet) setCachedReceiverWallet(receiverWallet);
        setConfig({
          algodServer: data?.algodServer?.trim() || getDefaultAlgodServer(),
          receiverWallet,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setConfig((prev) => ({ ...prev, loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
