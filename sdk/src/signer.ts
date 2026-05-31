import algosdk from "algosdk";

type AlgoAccount = { addr: string; sk: Uint8Array };

/** Signs payment transactions for the invoke → pay → complete flow. */
export interface Signer {
  readonly address: string;
  sign(txn: algosdk.Transaction): Promise<Uint8Array>;
}

/**
 * Server-side / script use only. Never embed a mnemonic in browser code.
 */
export class MnemonicSigner implements Signer {
  readonly address: string;
  private readonly sk: Uint8Array;

  constructor(mnemonic: string) {
    const account = algosdk.mnemonicToSecretKey(mnemonic.trim()) as unknown as AlgoAccount;
    this.address = account.addr;
    this.sk = account.sk;
  }

  async sign(txn: algosdk.Transaction): Promise<Uint8Array> {
    return txn.signTxn(this.sk);
  }
}

/**
 * Bring-your-own signer — plug in Pera Wallet, Defly, or any wallet that signs a single txn.
 */
export class BYOSigner implements Signer {
  readonly address: string;
  private readonly signFn: (txn: algosdk.Transaction) => Promise<Uint8Array>;

  constructor(address: string, signFn: (txn: algosdk.Transaction) => Promise<Uint8Array>) {
    const decoded = algosdk.decodeAddress(address.trim()) as { publicKey: Uint8Array };
    this.address = algosdk.encodeAddress(decoded.publicKey);
    this.signFn = signFn;
  }

  async sign(txn: algosdk.Transaction): Promise<Uint8Array> {
    return this.signFn(txn);
  }
}

/** Use when you already have a signed transaction bytes (e.g. from an external wallet UI). */
export class PreSignedSigner implements Signer {
  readonly address: string;
  private readonly signedBytes: Uint8Array;

  constructor(address: string, signedBytes: Uint8Array) {
    this.address = address;
    this.signedBytes = signedBytes;
  }

  async sign(_txn: algosdk.Transaction): Promise<Uint8Array> {
    return this.signedBytes;
  }
}
