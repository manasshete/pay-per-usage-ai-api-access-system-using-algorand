#!/usr/bin/env node

import { Command } from "commander";
import dotenv from "dotenv";
import { runDeploy } from "../src/deploy.js";
import { runBalance } from "../src/balance.js";
import { runMonitor } from "../src/monitor.js";
import { runVerifyContract } from "../src/verifyContract.js";

dotenv.config();

function printBanner() {
  if (process.argv.includes("-h") || process.argv.includes("--help") || process.argv.includes("help")) {
    return;
  }
  const pink = "\x1b[38;5;201m";
  const reset = "\x1b[0m";
  const green = "\x1b[32m";
  const gray = "\x1b[90m";

  console.log(`
  ${pink}.--.--.                            ___                                      ,--,    ${reset}
 ${pink}/  /    '.                        ,--.'|_    ,--,                          ,--.'|    ${reset}
${pink}|  :  /\x1b[38;5;201m\`. /                ,---,   |  | :,' ,--.'|         ,---,            |  | :    ${reset}
${pink};  |  |--\`             ,-+-. /  |  :  : ' : |  |,      ,-+-. /  |           :  : '    ${reset}
${pink}|  :  ;_       ,---.  ,--.'|'   |.;__,'  /  \`--'_     ,--.'|'   |  ,--.--.  |  ' |    ${reset}
 ${pink}\\  \\    \`.   /     \\|   |  ,"' ||  |   |   ,' ,'|   |   |  ,"' | /       \\ '  | |    ${reset}
  ${pink}\`----.   \\ /    /  |   | /  | |:__,'| :   '  | |   |   | /  | |.--.  .-. ||  | :    ${reset}
  ${pink}__ \\  \\  |.    ' / |   | |  | |  '  : |__ |  | :   |   | |  | | \\__\\/: . .'  : |__  ${reset}
 ${pink}/  /\`--'  /'   ;   /|   | |  |/   |  | '.'|'  : |__ |   | |  |/  ," .--.; ||  | '.'| ${reset}
${pink}'--'.     / '   |  / |   | |--'    ;  :    ;|  | '.'||   | |--'  /  /  ,.  |;  :    ; ${reset}
  ${pink}\`--'---'  |   :    |   |/        |  ,   / ;  :    ;|   |/     ;  :   .'   \\  ,   /  ${reset}
             ${pink}\\   \\  /'---'          ---\`-'  |  ,   / '---'      |  ,     .-./---\`-'   ${reset}
              ${pink}\`----'                         ---\`-'              \`--\`---'             ${reset}

     ${green}On-Chain Pay-Per-Use AI Gateway Protocol${reset}
     ${gray}Deploy and verify Sentinel contracts on Algorand${reset}
`);
}

printBanner();

const program = new Command();

program
  .name("sentinal")
  .description("Sentinel Pay-Per-Use AI Marketplace CLI tool")
  .version("1.0.0");

program
  .command("deploy")
  .description("Deploy a new Sentinel app contract to Algorand")
  .option("-n, --network <network>", "Algorand network (mainnet or testnet)", "testnet")
  .option("-m, --mnemonic <mnemonic>", "Deployer mnemonic; prefer DEPLOYER_MNEMONIC")
  .option("--min-micro-algos <amount>", "Minimum purchase amount in microAlgos")
  .option("--algod-server <url>", "Custom Algod server URL")
  .option("--algod-token <token>", "Custom Algod API token")
  .option("--output <path>", "Path for deployed contract metadata")
  .option("--yes-mainnet", "Confirm that real MainNet deployment is intended")
  .action(async (options) => {
    try {
      await runDeploy(options);
    } catch (e) {
      console.error("Deploy failed:", e.message);
      process.exit(1);
    }
  });

program
  .command("verify-contract")
  .description("Verify a deployed Sentinel contract and print its global state")
  .option("-i, --app-id <appId>", "Sentinel application ID")
  .option("-a, --contract-address <address>", "Expected contract address")
  .option("-n, --network <network>", "Algorand network (mainnet or testnet)", "testnet")
  .option("--algod-server <url>", "Custom Algod server URL")
  .option("--algod-token <token>", "Custom Algod API token")
  .action(async (options) => {
    try {
      await runVerifyContract(options);
    } catch (e) {
      console.error("Contract verification failed:", e.message);
      process.exit(1);
    }
  });

program
  .command("balance")
  .description("Check the account balance of a wallet address on Algorand")
  .requiredOption("-a, --address <address>", "Algorand wallet address")
  .option("-n, --network <network>", "Algorand network (mainnet or testnet)", "testnet")
  .action(async (options) => {
    try {
      await runBalance(options);
    } catch (e) {
      console.error("Balance query failed:", e.message);
      process.exit(1);
    }
  });

program
  .command("monitor")
  .description("Monitor real-time confirmed transaction logs for a Sentinel app ID")
  .requiredOption("-i, --app-id <appId>", "Sentinel application ID")
  .option("-n, --network <network>", "Algorand network (mainnet or testnet)", "testnet")
  .action(async (options) => {
    try {
      await runMonitor(options);
    } catch (e) {
      console.error("Monitor failed:", e.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
