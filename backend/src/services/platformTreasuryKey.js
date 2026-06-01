import algosdk from "algosdk";
import { mnemonicToSeedSync } from "@scure/bip39";
import {
  BIP32DerivationType,
  fromSeed,
  KeyContext,
  XHDWalletAPI,
} from "@algorandfoundation/xhd-wallet-api";

let cached = null;

export function treasuryConfigError(message, code) {
  return Object.assign(new Error(message), { status: 503, code });
}

function wordCount(mnemonic) {
  return mnemonic.split(/\s+/).filter(Boolean).length;
}

function normalizeExpectedAddress(raw) {
  const s = String(raw ?? "").trim();
  if (!s || !algosdk.isValidAddress(s)) return null;
  return algosdk.encodeAddress(algosdk.decodeAddress(s).publicKey);
}

function tryAlgo25Mnemonic(mnemonic) {
  try {
    const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
    return {
      mode: "algo25",
      addr,
      sk,
      signTransaction(txn) {
        return txn.signTxn(sk);
      },
    };
  } catch {
    return null;
  }
}

async function deriveBip39Treasury(mnemonic, expectedAddr) {
  const wc = wordCount(mnemonic);
  if (wc < 12 || wc > 24 || wc % 3 !== 0) {
    return null;
  }

  const seed = mnemonicToSeedSync(mnemonic.normalize("NFKD"), "");
  const rootKey = fromSeed(Buffer.from(seed));
  const api = new XHDWalletAPI();

  const fixedAccount = process.env.PLATFORM_HD_ACCOUNT?.trim();
  const fixedIndex = process.env.PLATFORM_HD_INDEX?.trim();
  const accountCandidates =
    fixedAccount !== undefined && fixedAccount !== ""
      ? [Number(fixedAccount)]
      : Array.from({ length: Number(process.env.PLATFORM_HD_ACCOUNT_MAX || 15) }, (_, i) => i);
  const indexCandidates =
    fixedIndex !== undefined && fixedIndex !== ""
      ? [Number(fixedIndex)]
      : Array.from({ length: Number(process.env.PLATFORM_HD_INDEX_MAX || 5) }, (_, i) => i);

  for (const account of accountCandidates) {
    if (!Number.isInteger(account) || account < 0) continue;
    for (const index of indexCandidates) {
      if (!Number.isInteger(index) || index < 0) continue;
      const pub = await api.keyGen(
        rootKey,
        KeyContext.Address,
        account,
        index,
        BIP32DerivationType.Peikert
      );
      const addr = algosdk.encodeAddress(pub);
      const entry = { mode: "bip39", rootKey, addr, account, index, api };
      if (expectedAddr) {
        if (addr === expectedAddr) return entry;
      } else {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Resolve platform treasury signing material.
 * Supports Algorand 25-word mnemonics and Pera Universal 12/15/18/21/24-word BIP-39 phrases (ARC-52).
 */
export async function getPlatformTreasuryKey() {
  if (cached) {
    return cached;
  }

  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) {
    throw treasuryConfigError(
      "Creator withdrawals are not enabled on this server (PLATFORM_MNEMONIC is not set).",
      "TREASURY_NOT_CONFIGURED"
    );
  }

  const expectedAddr = normalizeExpectedAddress(
    process.env.TREASURY_WALLET ||
      process.env.RECEIVER_WALLET ||
      process.env.PLATFORM_WALLET_ADDRESS
  );

  const algo25 = tryAlgo25Mnemonic(mnemonic);
  if (algo25) {
    if (expectedAddr && algo25.addr !== expectedAddr) {
      throw treasuryConfigError(
        "PLATFORM_MNEMONIC does not match TREASURY_WALLET. Use the recovery phrase for that address, or update TREASURY_WALLET.",
        "TREASURY_ADDRESS_MISMATCH"
      );
    }
    cached = algo25;
    return cached;
  }

  const bip39 = await deriveBip39Treasury(mnemonic, expectedAddr);
  if (bip39) {
    cached = {
      mode: "bip39",
      addr: bip39.addr,
      account: bip39.account,
      index: bip39.index,
      async signTransaction(txn) {
        const sig = await bip39.api.signAlgoTransaction(
          bip39.rootKey,
          KeyContext.Address,
          bip39.account,
          bip39.index,
          txn.bytesToSign(),
          BIP32DerivationType.Peikert
        );
        return txn.attachSignature(bip39.addr, sig);
      },
    };
    return cached;
  }

  const wc = wordCount(mnemonic);
  if (expectedAddr) {
    throw treasuryConfigError(
      `Could not derive treasury address ${expectedAddr.slice(0, 8)}… from your ${wc}-word phrase. ` +
        "Confirm it is your Pera Universal backup and TREASURY_WALLET matches that account. " +
        "Optional: set PLATFORM_HD_ACCOUNT and PLATFORM_HD_INDEX for the account slot in Pera.",
      "TREASURY_DERIVATION_FAILED"
    );
  }

  throw treasuryConfigError(
    wc === 24
      ? "24-word phrase could not be derived. Use your full Pera Universal backup (all 24 words, correct order)."
      : `Invalid PLATFORM_MNEMONIC (${wc} words). Use a 25-word Algorand phrase or a 12–24 word Pera Universal phrase.`,
    "TREASURY_INVALID_MNEMONIC"
  );
}

/** Sync probe for startup logs (algo25 only; bip39 logged separately). */
export function probePlatformMnemonic() {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) {
    return { status: "missing" };
  }
  const wc = wordCount(mnemonic);
  const algo25 = tryAlgo25Mnemonic(mnemonic);
  if (algo25) {
    return { status: "ok", mode: "algo25", addr: algo25.addr, wordCount: wc };
  }
  if (wc >= 12 && wc <= 24 && wc % 3 === 0) {
    return { status: "bip39_pending", wordCount: wc };
  }
  return { status: "invalid", wordCount: wc };
}
