import algosdk from "algosdk";
import type { AlgorandNetwork } from "./types.js";

export const DEFAULT_ALGOD: Record<AlgorandNetwork, string> = {
  testnet: "https://testnet-api.algonode.cloud",
  mainnet: "https://mainnet-api.algonode.cloud",
};

export function createAlgodClient(
  network: AlgorandNetwork,
  algodServer?: string,
  algodToken = ""
): algosdk.Algodv2 {
  const server = (algodServer || DEFAULT_ALGOD[network]).replace(/\/$/, "");
  return new algosdk.Algodv2(algodToken, server, "");
}

export interface BuildPaymentTxParams {
  from: string;
  to: string;
  microAlgos: number;
  paymentRef: string;
  algodClient: algosdk.Algodv2;
}

/** Build an unsigned Algorand payment transaction for the invoke quote. */
export async function buildPaymentTx(params: BuildPaymentTxParams): Promise<algosdk.Transaction> {
  const { from, to, microAlgos, paymentRef, algodClient } = params;
  const suggestedParams = await algodClient.getTransactionParams().do();
  const note = new TextEncoder().encode(paymentRef);
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: to,
    amount: Math.round(microAlgos),
    note,
    suggestedParams,
  });
}

export interface SubmitSignedPaymentParams {
  signedTxn: Uint8Array;
  algodClient: algosdk.Algodv2;
  waitRounds?: number;
}

/** Submit a signed payment and wait for confirmation. Returns the transaction id. */
export async function submitSignedPayment(params: SubmitSignedPaymentParams): Promise<string> {
  const { signedTxn, algodClient, waitRounds = 4 } = params;
  const submitted = await algodClient.sendRawTransaction(signedTxn).do();
  const txId = submitted.txid ?? (submitted as { txId?: string }).txId;
  if (!txId) {
    throw new Error("Algod did not return a transaction id after submit");
  }
  await algosdk.waitForConfirmation(algodClient, txId, waitRounds);
  return txId;
}
