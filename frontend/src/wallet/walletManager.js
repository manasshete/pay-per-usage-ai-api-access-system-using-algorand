import {
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
  NetworkId,
} from "@txnlab/use-wallet-react";
import { getDefaultAlgodServer } from "../utils/algodConfig.js";

const algodBase = getDefaultAlgodServer();

const networks = new NetworkConfigBuilder()
  .testnet({
    algod: {
      baseServer: algodBase,
      port: "",
      token: "",
    },
  })
  .build();

/** Shared WalletManager — Pera, Defly, Exodus, Kibisis, Lute (TestNet). */
export const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.EXODUS,
    WalletId.KIBISIS,
    WalletId.LUTE,
  ],
  networks,
  defaultNetwork: NetworkId.TESTNET,
});
