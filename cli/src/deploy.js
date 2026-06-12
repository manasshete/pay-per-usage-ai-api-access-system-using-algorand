import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import algosdk from "algosdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORKS = {
  testnet: "https://testnet-api.algonode.cloud",
  mainnet: "https://mainnet-api.algonode.cloud",
};

function normalizeNetwork(value) {
  const network = String(value || "testnet").trim().toLowerCase();
  if (!NETWORKS[network]) {
    throw new Error(`Unsupported network "${value}". Use testnet or mainnet.`);
  }
  return network;
}

function getAlgodClient({ network, algodServer, algodToken }) {
  const server = String(algodServer || NETWORKS[network]).trim().replace(/\/$/, "");
  if (!server.startsWith("https://") && !server.startsWith("http://")) {
    throw new Error("Algod server must be an http(s) URL.");
  }
  return {
    client: new algosdk.Algodv2(algodToken || "", server, ""),
    server,
  };
}

function findTealFiles() {
  const candidates = [
    path.join(process.cwd(), "contract", "artifacts"),
    path.join(process.cwd(), "artifacts"),
    path.join(__dirname, "..", "..", "contract", "artifacts"),
  ];

  for (const dir of candidates) {
    const approvalPath = path.join(dir, "SentinelContract.approval.teal");
    const clearPath = path.join(dir, "SentinelContract.clear.teal");
    if (fs.existsSync(approvalPath) && fs.existsSync(clearPath)) {
      return { approvalPath, clearPath, dir };
    }
  }
  throw new Error(
    "Could not locate SentinelContract TEAL artifacts. Compile the Puya contract first."
  );
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return parsed;
}

function confirmationAppId(status) {
  const raw = status?.applicationIndex ?? status?.["application-index"];
  if (raw === undefined || raw === null || BigInt(raw) <= 0n) {
    throw new Error("Deployment confirmed, but Algod did not return an application ID.");
  }
  return BigInt(raw);
}

function globalUintMap(app) {
  const rows = app?.params?.globalState || app?.params?.["global-state"] || [];
  return Object.fromEntries(
    rows
      .filter((row) => row?.value?.uint !== undefined)
      .map((row) => [
        Buffer.from(row.key, "base64").toString("utf8"),
        Number(row.value.uint),
      ])
  );
}

async function verifyDeployment(client, appId, expectedAddress, expectedMinMicro) {
  const app = await client.getApplicationByID(appId).do();
  const actualAddress = algosdk.getApplicationAddress(appId).toString();
  if (actualAddress !== expectedAddress) {
    throw new Error("Deployed application address verification failed.");
  }

  const state = globalUintMap(app);
  if (state.min_payment !== expectedMinMicro) {
    throw new Error(
      `Deployed minimum payment is ${state.min_payment}, expected ${expectedMinMicro}.`
    );
  }
  return state;
}

export async function runDeploy(options) {
  const network = normalizeNetwork(options.network);
  if (network === "mainnet" && !options.yesMainnet) {
    throw new Error("MainNet deployment requires --yes-mainnet.");
  }

  const rawMnemonic = (options.mnemonic || process.env.DEPLOYER_MNEMONIC || "").trim();
  if (!rawMnemonic) {
    throw new Error("Set DEPLOYER_MNEMONIC or pass --mnemonic.");
  }

  const minMicro = parsePositiveInteger(
    options.minMicroAlgos || process.env.SENTINEL_MIN_MICRO_ALGOS || 1_000_000,
    "Minimum payment"
  );
  const { approvalPath, clearPath, dir } = findTealFiles();
  const approvalTeal = fs.readFileSync(approvalPath, "utf8");
  const clearTeal = fs.readFileSync(clearPath, "utf8");
  const { client, server } = getAlgodClient({
    network,
    algodServer: options.algodServer || process.env.ALGOD_SERVER,
    algodToken: options.algodToken || process.env.ALGOD_TOKEN,
  });

  console.log(`Using contract artifacts from: ${dir}`);
  console.log(`Connecting to Algorand ${network}: ${server}`);

  await client.status().do();
  const account = algosdk.mnemonicToSecretKey(rawMnemonic);
  const sender = account.addr.toString();
  const accountInfo = await client.accountInformation(sender).do();
  const balance = Number(accountInfo.amount);
  if (balance < 500_000) {
    throw new Error(
      `Deployer ${sender} has only ${balance} microAlgos. Fund it before deployment.`
    );
  }
  console.log(`Deployer: ${sender} (${(balance / 1e6).toFixed(6)} ALGO)`);

  console.log("Compiling contract TEAL on Algod...");
  const approvalResult = await client.compile(approvalTeal).do();
  const clearResult = await client.compile(clearTeal).do();
  const approvalBytes = Buffer.from(approvalResult.result, "base64");
  const clearBytes = Buffer.from(clearResult.result, "base64");

  const suggestedParams = await client.getTransactionParams().do();
  const minMicroBuf = Buffer.alloc(8);
  minMicroBuf.writeBigUInt64BE(BigInt(minMicro));
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender,
    suggestedParams,
    onComplete: algosdk.OnComplete.NoOpOC,
    approvalProgram: approvalBytes,
    clearProgram: clearBytes,
    numGlobalInts: 3,
    numGlobalByteSlices: 0,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    appArgs: [
      algosdk.ABIMethod.fromSignature("create_application(uint64)void").getSelector(),
      minMicroBuf,
    ],
  });

  const signed = txn.signTxn(account.sk);
  const submitted = await client.sendRawTransaction(signed).do();
  const txId = submitted?.txid ?? submitted?.txId;
  if (!txId) throw new Error("Algod did not return a deployment transaction ID.");

  console.log(`Submitted deployment transaction: ${txId}`);
  const status = await algosdk.waitForConfirmation(client, txId, 12);
  const appIdBigInt = confirmationAppId(status);
  const appId = Number(appIdBigInt);
  if (!Number.isSafeInteger(appId)) {
    throw new Error("Application ID exceeds JavaScript's safe integer range.");
  }
  const contractAddress = algosdk.getApplicationAddress(appIdBigInt).toString();
  const state = await verifyDeployment(client, appIdBigInt, contractAddress, minMicro);

  const infoPath = path.resolve(
    options.output || path.join(path.dirname(dir), "contract_info.json")
  );
  const payload = {
    appId,
    contractAddress,
    network,
    algodServer: server,
    deploymentTxId: txId,
    minPaymentMicroAlgos: minMicro,
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  fs.writeFileSync(infoPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("\nDeployment verified");
  console.log(`Application ID:   ${appId}`);
  console.log(`Contract address: ${contractAddress}`);
  console.log(`Global state:     ${JSON.stringify(state)}`);
  console.log(`Saved config:     ${infoPath}`);
  console.log("\nSet these non-secret variables on your Render backend:");
  console.log(`ALGO_APP_ID=${appId}`);
  console.log(`ALGO_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`ALGOD_SERVER=${server}`);
  console.log("\nDo not add DEPLOYER_MNEMONIC to Render. It is only needed during deployment.");

  return payload;
}

export { globalUintMap, normalizeNetwork };
