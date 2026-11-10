import { createHash } from "node:crypto";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  PublicKey,
  actions,
  baseEncode,
  teraToGas,
  type KeyPairString,
} from "near-api-js";
import type { RootKey } from "./credentials.js";
import type { AccountState } from "./plan.js";

const NOT_FOUND = /does not exist|UNKNOWN_ACCOUNT|doesn't exist/i;
const NO_CODE = /CodeDoesNotExist|no contract code|has no contract|not been initialized|not initialized|Cannot deserialize|MethodNotFound|Method .* not found/i;

export function wasmHash(bytes: Uint8Array): string {
  return baseEncode(createHash("sha256").update(bytes).digest());
}

export interface TxInfo {
  hash: string;
}

export class Chain {
  readonly provider: JsonRpcProvider;
  readonly root: Account;
  private readonly signer: KeyPairSigner;

  constructor(
    rpcUrl: string,
    private readonly rootKey: RootKey,
  ) {
    this.provider = new JsonRpcProvider({ url: rpcUrl });
    this.signer = KeyPairSigner.fromSecretKey(rootKey.secretKey as KeyPairString);
    this.root = new Account(rootKey.accountId, this.provider, this.signer);
  }

  async networkId(): Promise<string> {
    return this.provider.getNetworkId();
  }

  /** An account that exists on chain, or `exists: false`. Anything but "not found" is rethrown. */
  async accountState(accountId: string): Promise<AccountState> {
    try {
      const view = await this.provider.viewAccount({ accountId });
      const zero = "11111111111111111111111111111111";
      const hasCode = view.code_hash !== zero;
      const usedOnStorage = BigInt(view.storage_usage) * 10n ** 19n;
      const total = BigInt(view.amount);
      return {
        exists: true,
        codeHash: hasCode ? view.code_hash : null,
        initialized: null,
        nearBalance: total > usedOnStorage ? total - usedOnStorage : 0n,
        nearTotal: total,
      };
    } catch (error) {
      if (NOT_FOUND.test(String(error instanceof Error ? error.message : error))) {
        return { exists: false, codeHash: null, initialized: null, nearBalance: 0n };
      }
      throw error;
    }
  }

  /** Read-only call. Returns the parsed JSON. */
  async view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
    const out = await this.provider.callFunction({ contractId, method, args });
    return out as T;
  }

  /** True when `method` answers, false when the contract is missing or not initialized yet. */
  async answers(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<boolean> {
    try {
      await this.view(contractId, method, args);
      return true;
    } catch (error) {
      if (NO_CODE.test(String(error instanceof Error ? error.message : error))) return false;
      throw error;
    }
  }

  private async send(
    account: Account,
    receiverId: string,
    acts: ReturnType<typeof actions.transfer>[],
  ): Promise<TxInfo> {
    const res = await account.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL" });
    return { hash: res.transaction.hash as string };
  }

  /** New account with the given key, funded, with code and an init call, in one atomic transaction. */
  createContractAccount(
    account: string,
    publicKey: string,
    fund: bigint,
    wasm: Uint8Array,
    init: { method: string; args: Record<string, unknown> },
  ): Promise<TxInfo> {
    return this.send(this.root, account, [
      actions.createAccount(),
      actions.transfer(fund),
      actions.addFullAccessKey(PublicKey.from(publicKey)),
      actions.deployContract(wasm),
      actions.functionCall(init.method, init.args, teraToGas(30), 0n),
    ]);
  }

  createPlainAccount(account: string, publicKey: string, fund: bigint): Promise<TxInfo> {
    return this.send(this.root, account, [
      actions.createAccount(),
      actions.transfer(fund),
      actions.addFullAccessKey(PublicKey.from(publicKey)),
    ]);
  }

  /** The contract accounts carry the root public key, so the root key can sign for them. */
  private asContract(account: string): Account {
    return new Account(account, this.provider, this.signer);
  }

  /** Deletes a contract account. All of its NEAR goes to the root. The root key signs, as it is on the account. */
  async deleteAccount(account: string): Promise<TxInfo> {
    const res = await this.asContract(account).deleteAccount(this.rootKey.accountId);
    return { hash: res.transaction.hash as string };
  }

  redeploy(account: string, wasm: Uint8Array): Promise<TxInfo> {
    return this.send(this.asContract(account), account, [actions.deployContract(wasm)]);
  }

  init(account: string, init: { method: string; args: Record<string, unknown> }): Promise<TxInfo> {
    return this.send(this.root, account, [actions.functionCall(init.method, init.args, teraToGas(30), 0n)]);
  }

  transfer(account: string, amount: bigint): Promise<TxInfo> {
    return this.send(this.root, account, [actions.transfer(amount)]);
  }

  call(
    contract: string,
    method: string,
    args: Record<string, unknown>,
    deposit = 0n,
    gasTera = 30,
  ): Promise<TxInfo> {
    return this.send(this.root, contract, [actions.functionCall(method, args, teraToGas(gasTera), deposit)]);
  }

  get rootPublicKey(): string {
    return this.rootKey.publicKey;
  }
}

export function newKeyPair(): { publicKey: string; secretKey: string } {
  const pair = KeyPair.fromRandom("ed25519");
  return { publicKey: pair.getPublicKey().toString(), secretKey: pair.toString() };
}
