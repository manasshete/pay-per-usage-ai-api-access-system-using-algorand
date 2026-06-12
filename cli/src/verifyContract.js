import algosdk from "algosdk";
import { globalUintMap, normalizeNetwork } from "./deploy.js";

const NETWORKS = {
  testnet: "https://testnet-api.algonode.cloud",
  mainnet: "https://mainnet-api.algonode.cloud",
};

export async function runVerifyContract(options) {
  const network = normalizeNetwork(options.network);
  const appId = Number(options.appId || process.env.ALGO_APP_ID);
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error("Pass a valid --app-id or set ALGO_APP_ID.");
  }

  const server = String(
    options.algodServer || process.env.ALGOD_SERVER || NETWORKS[network]
  ).trim().replace(/\/$/, "");
  const client = new algosdk.Algodv2(options.algodToken || process.env.ALGOD_TOKEN || "", server, "");
  const app = await client.getApplicationByID(appId).do();
  const address = algosdk.getApplicationAddress(appId).toString();
  const expectedAddress = String(
    options.contractAddress || process.env.ALGO_CONTRACT_ADDRESS || ""
  ).trim();
  if (expectedAddress && address !== expectedAddress) {
    throw new Error(`Address mismatch: App ${appId} derives ${address}, not ${expectedAddress}.`);
  }

  const state = globalUintMap(app);
  console.log(`Contract verified on ${network}`);
  console.log(`Application ID:   ${appId}`);
  console.log(`Contract address: ${address}`);
  console.log(`Algod server:     ${server}`);
  console.log(`Global state:     ${JSON.stringify(state)}`);
  return { appId, contractAddress: address, network, algodServer: server, state };
}
