import { JsonRpcProvider, getTransactionLastResult, teraToGas } from "near-api-js";
import type { Actor } from "./actors.js";
import { formatTusdc } from "./config.js";

export const EXPLORER = "https://testnet.nearblocks.io";
export const UNIT = 1_000_000n;
const HOUR_MS = 3_600_000;

export interface Tx {
  hash: string;
  /** parsed return value of the last receipt, when there is one */
  value: unknown;
  /** every log line of every receipt, events included */
  logs: string[];
}

export interface InvitationView {
  token_id: number;
  hajat_id: number;
  owner: string;
  label: string;
  state: string;
  card_status: string;
  sealed: string;
  released: string;
  settled: string;
  reciprocated: string;
  checked_in: boolean;
  repays: [number, string][];
}

export interface HajatView {
  id: number;
  host: string;
  title: string;
  status: string;
  invite_count: number;
  sealed_total: string;
  released_total: string;
  event_at_ms: number;
}

interface LedgerRow {
  counterparty: string;
  remaining: string;
  token_ids: string[];
}

export interface Ledger {
  owed_to_me: LedgerRow[];
  i_owe: LedgerRow[];
}

/** Thin, typed wrapper over the amplop and tUSDC contracts for the seed and demo scripts. */
export class Story {
  constructor(
    readonly provider: JsonRpcProvider,
    readonly amplop: string,
    readonly tusdc: string,
  ) {}

  // ---------------------------------------------------------------- reads

  async view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
    return (await this.provider.callFunction({ contractId, method, args })) as T;
  }

  /** Block time in ms. The contract compares against this clock, not the local one. */
  async chainNowMs(): Promise<number> {
    const block = await this.provider.viewBlock({ finality: "final" });
    return Number(BigInt(block.header.timestamp_nanosec) / 1_000_000n);
  }

  async nearBalance(accountId: string): Promise<bigint> {
    const a = await this.provider.viewAccount({ accountId });
    return BigInt(a.amount);
  }

  async tusdcBalance(accountId: string): Promise<bigint> {
    return BigInt(await this.view<string>(this.tusdc, "ft_balance_of", { account_id: accountId }));
  }

  hajatCount = async (): Promise<number> =>
    (await this.view<{ hajat_count: number }>(this.amplop, "get_config")).hajat_count;

  getHajat = (id: number) => this.view<HajatView | null>(this.amplop, "get_hajat", { hajat_id: id });
  getInvitation = (id: number) => this.view<InvitationView | null>(this.amplop, "get_invitation", { token_id: id });
  getLedger = (account: string) => this.view<Ledger>(this.amplop, "get_ledger", { account_id: account });

  async getPair(giver: string, receiver: string): Promise<{ remaining: bigint; open: number[] }> {
    const p = await this.view<{ remaining: string; open: string[] }>(this.amplop, "get_pair", { giver, receiver });
    return { remaining: BigInt(p.remaining), open: p.open.map(Number) };
  }

  async suggestReply(hajatId: number, guest: string): Promise<bigint> {
    return BigInt(await this.view<string>(this.amplop, "suggest_reply", { hajat_id: hajatId, guest }));
  }

  /** The card the contract draws, decoded from its data URI. */
  async card(tokenId: number): Promise<string> {
    const tok = await this.view<{ metadata: { media: string | null } } | null>(this.amplop, "nft_token", {
      token_id: String(tokenId),
    });
    const uri = tok?.metadata.media ?? "";
    return Buffer.from(uri.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString("utf8");
  }

  // ---------------------------------------------------------------- writes

  async call(
    actor: Actor,
    contractId: string,
    method: string,
    args: Record<string, unknown>,
    opts: { deposit?: bigint; gasTera?: number } = {},
  ): Promise<Tx> {
    const res = await actor.account.callFunctionRaw({
      contractId,
      methodName: method,
      args,
      deposit: opts.deposit ?? 0n,
      gas: teraToGas(opts.gasTera ?? 100),
      waitUntil: "FINAL",
    });
    const status = res.status as unknown;
    if (typeof status === "object" && status !== null && "Failure" in status) {
      throw new Error(`${method} failed: ${JSON.stringify((status as { Failure: unknown }).Failure)}`);
    }
    let value: unknown = null;
    try {
      value = getTransactionLastResult(res);
    } catch {
      value = null;
    }
    const logs = res.receipts_outcome.flatMap((o) => o.outcome.logs);
    return { hash: res.transaction.hash as string, value, logs };
  }

  async createHajat(
    host: Actor,
    input: { title: string; kind: string; venue: string; hoursAhead: number; policy: "InviteOnly" | "OpenLink" },
  ): Promise<{ id: number; tx: Tx }> {
    const eventAt = (await this.chainNowMs()) + input.hoursAhead * HOUR_MS;
    const tx = await this.call(
      host,
      this.amplop,
      "create_hajat",
      { title: input.title, kind: input.kind, venue: input.venue, event_at_ms: eventAt, join_policy: input.policy },
      { deposit: 50_000_000_000_000_000_000_000n },
    );
    return { id: Number(tx.value), tx };
  }

  async inviteMany(host: Actor, hajatId: number, guests: { account: string; label: string }[]) {
    const tx = await this.call(
      host,
      this.amplop,
      "invite_many",
      { hajat_id: hajatId, items: guests.map((g) => ({ guest: g.account, label: g.label })) },
      { deposit: BigInt(guests.length) * 20_000_000_000_000_000_000_000n },
    );
    return { ids: (tx.value as string[]).map(Number), tx };
  }

  /** Seals tUSDC into an invitation with one ft_transfer_call. */
  seal(guest: Actor, tokenId: number, amount: bigint, note?: string): Promise<Tx> {
    const msg = JSON.stringify(note ? { token_id: String(tokenId), note } : { token_id: String(tokenId) });
    return this.call(
      guest,
      this.tusdc,
      "ft_transfer_call",
      { receiver_id: this.amplop, amount: amount.toString(), msg },
      { deposit: 1n, gasTera: 100 },
    );
  }

  checkIn = (host: Actor, tokenId: number) =>
    this.call(host, this.amplop, "check_in", { token_id: tokenId }, { gasTera: 150 });

  cancel = (host: Actor, hajatId: number) =>
    this.call(host, this.amplop, "cancel_hajat", { hajat_id: hajatId }, { gasTera: 30 });

  refund = (anyone: Actor, tokenId: number) =>
    this.call(anyone, this.amplop, "refund", { token_id: tokenId }, { gasTera: 100 });
}

/** Prints numbered steps with their explorer links and counts what was checked. */
export class Reporter {
  readonly links: { n: number; label: string; hash: string }[] = [];
  private n = 0;
  failures: string[] = [];
  checks = 0;
  private readonly started = Date.now();

  step(label: string, tx?: Tx): void {
    this.n += 1;
    const num = String(this.n).padStart(2, "0");
    if (tx) this.links.push({ n: this.n, label, hash: tx.hash });
    const tail = tx ? `${EXPLORER}/txns/${tx.hash}` : "(view call)";
    console.log(`[${num}] ${label} ${".".repeat(Math.max(3, 58 - label.length))} ${tail}`);
  }

  expect(ok: boolean, what: string): void {
    this.checks += 1;
    if (ok) return;
    this.failures.push(what);
    console.log(`     FAIL expected: ${what}`);
  }

  summary(): number {
    const seconds = Math.round((Date.now() - this.started) / 1000);
    const bad = this.failures.length;
    console.log(
      `\n${bad === 0 ? "OK" : "FAILED"}: ${this.n} steps, ${this.links.length} explorer links, ${this.checks} checks, ${bad} failures, ${seconds} s`,
    );
    return bad === 0 ? 0 : 1;
  }
}

export const tusdc = (units: bigint | string) => formatTusdc(BigInt(units));
