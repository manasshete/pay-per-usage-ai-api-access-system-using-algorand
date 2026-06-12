# Sentinel Contract Deployment

The smart contract is deployed to Algorand, not to Render. Render only needs the
deployed application ID, application address, and Algod URL so the backend can
read contract state and the frontend can build contract calls.

The canonical deployment path is the JavaScript CLI in `cli/`. The deployer:

- validates the network, deployer mnemonic, balance, and minimum payment;
- requires explicit confirmation before a MainNet deployment;
- compiles the committed Puya-generated TEAL through Algod;
- deploys and verifies the application and its global state;
- writes `contract/contract_info.json`;
- prints the exact non-secret Render environment variables.

## Current TestNet Deployment

```text
ALGO_APP_ID=763786783
ALGO_CONTRACT_ADDRESS=F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
ALGOD_SERVER=https://testnet-api.algonode.cloud
```

Verify it without spending ALGO:

```bash
npm ci --prefix cli
npm run contract:verify -- --app-id 763786783 \
  --contract-address F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
```

PowerShell:

```powershell
npm.cmd ci --prefix cli
npm.cmd run contract:verify -- --app-id 763786783 `
  --contract-address F3IGSPZCDJ6TUQSS22YSSGXNJP2JR47SQ5C5O64PVJCJ7CWTG6XNFTDLHM
```

## Deploy a New TestNet Contract

1. Compile the Puya source whenever `contract/sentinel_contract.py` changes:

```powershell
cd contract
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m puyapy sentinel_contract.py --out-dir artifacts
cd ..
```

2. Fund a dedicated TestNet deployer account. Keep enough ALGO for application
   creation and minimum-balance requirements.

3. Set the mnemonic only in the current local terminal:

```powershell
$env:DEPLOYER_MNEMONIC="your 25 word Algorand mnemonic"
$env:SENTINEL_MIN_MICRO_ALGOS="1000000"
```

4. Install the CLI and deploy:

```powershell
npm.cmd ci --prefix cli
npm.cmd run contract:deploy -- --network testnet
```

The command verifies the new application and prints:

```text
ALGO_APP_ID=...
ALGO_CONTRACT_ADDRESS=...
ALGOD_SERVER=https://testnet-api.algonode.cloud
```

5. Remove the mnemonic from the terminal:

```powershell
Remove-Item Env:DEPLOYER_MNEMONIC
```

Never put `DEPLOYER_MNEMONIC` in Render, Git, frontend variables, logs, or chat.

## Configure Existing Render Services

In the Render dashboard, open the backend web service, then add or update:

```text
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGO_APP_ID=<new application ID>
ALGO_CONTRACT_ADDRESS=<new application address>
```

Save the variables and trigger a backend redeploy. The frontend needs no
contract-specific environment variables because it receives contract
configuration from the backend API. If the frontend is a separate Render
Static Site, keep its existing `VITE_API_URL` pointed at the backend.

The repository `render.yaml` contains the current TestNet values. Update it
after deploying a replacement contract so future Blueprint syncs do not restore
old values.

## Production Verification

After Render finishes deploying:

```text
GET https://<your-render-backend>/api/health
GET https://<your-render-backend>/api/contract/stats?refresh=1
```

The contract response should report:

- `configured: true`
- the expected app ID and address
- `minPaymentAlgo: 1` when deployed with `1000000` microAlgos

The Smart Contract page includes a **Test purchase** action. It creates one
atomic group containing the payment and `purchase(pay)void` call. This spends
the displayed minimum amount and should increment both contract counters.

## MainNet

Use a separate funded MainNet deployer and review every address and amount.
MainNet deployment is intentionally blocked unless explicitly confirmed:

```powershell
npm.cmd run contract:deploy -- --network mainnet --yes-mainnet
```

Deploying a changed contract creates a new application ID. Update Render after
every new deployment; the old application's state is not migrated automatically.
