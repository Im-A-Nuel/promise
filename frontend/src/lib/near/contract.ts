import { z } from "zod";
import { env } from "@/lib/env";
import { viewCall, type RpcOptions } from "@/lib/near/provider";
import {
  configSchema,
  hajatSchema,
  invitationSchema,
  ledgerSchema,
  nftTokenSchema,
  pairSchema,
  type Config,
  type Hajat,
  type InvitationView,
  type Ledger,
  type NftToken,
  type Pair,
} from "@/lib/near/types";

// Every read of the amplop contract goes through this file. Components never call RPC directly.

async function view<S extends z.ZodTypeAny>(
  schema: S,
  method: string,
  args: Record<string, unknown>,
  options?: RpcOptions,
): Promise<z.infer<S>> {
  const raw = await viewCall(env.amplopId, method, args, options);
  return schema.parse(raw);
}

export interface Page {
  from?: number;
  limit?: number;
}

export function getConfig(options?: RpcOptions): Promise<Config> {
  return view(configSchema, "get_config", {}, options);
}

export function getHajat(hajatId: number, options?: RpcOptions): Promise<Hajat | null> {
  return view(hajatSchema.nullable(), "get_hajat", { hajat_id: hajatId }, options);
}

/** Newest first. */
export function getHajats(page: Page = {}, options?: RpcOptions): Promise<Hajat[]> {
  return view(z.array(hajatSchema), "get_hajats", { from: page.from ?? 0, limit: page.limit ?? 20 }, options);
}

/** Newest first. */
export function getHajatsByHost(host: string, page: Page = {}, options?: RpcOptions): Promise<Hajat[]> {
  return view(
    z.array(hajatSchema),
    "get_hajats_by_host",
    { host, from: page.from ?? 0, limit: page.limit ?? 20 },
    options,
  );
}

export function getInvitation(tokenId: number, options?: RpcOptions): Promise<InvitationView | null> {
  return view(invitationSchema.nullable(), "get_invitation", { token_id: tokenId }, options);
}

/** Oldest first. */
export function getInvitations(hajatId: number, page: Page = {}, options?: RpcOptions): Promise<InvitationView[]> {
  return view(
    z.array(invitationSchema),
    "get_invitations",
    { hajat_id: hajatId, from: page.from ?? 0, limit: page.limit ?? 50 },
    options,
  );
}

export function getInvitationFor(
  hajatId: number,
  account: string,
  options?: RpcOptions,
): Promise<InvitationView | null> {
  return view(invitationSchema.nullable(), "get_invitation_for", { hajat_id: hajatId, account }, options);
}

export function getNftToken(tokenId: number, options?: RpcOptions): Promise<NftToken | null> {
  return view(nftTokenSchema.nullable(), "nft_token", { token_id: String(tokenId) }, options);
}

export function getNftTokensForOwner(account: string, page: Page = {}, options?: RpcOptions): Promise<NftToken[]> {
  return view(
    z.array(nftTokenSchema),
    "nft_tokens_for_owner",
    { account_id: account, from_index: String(page.from ?? 0), limit: page.limit ?? 20 },
    options,
  );
}

/** tUSDC balance in base units, as a decimal string. */
export async function getTusdcBalance(account: string, options?: RpcOptions): Promise<string> {
  const raw = await viewCall(env.ftId, "ft_balance_of", { account_id: account }, options);
  return z.string().regex(/^\d+$/).parse(raw);
}

/** Who owes me and whom I owe. Each list is paged separately (limit max 50). */
export function getLedger(account: string, page: Page = {}, options?: RpcOptions): Promise<Ledger> {
  return view(
    ledgerSchema,
    "get_ledger",
    { account_id: account, from: page.from ?? 0, limit: page.limit ?? 50 },
    options,
  );
}

/** What `receiver` owes `giver`. */
export function getPair(giver: string, receiver: string, options?: RpcOptions): Promise<Pair> {
  return view(pairSchema, "get_pair", { giver, receiver }, options);
}

/** What `guest` still owes the host of this hajat, in base units. Prefills "Pay back what I owe". */
export function suggestReply(hajatId: number, guest: string, options?: RpcOptions): Promise<string> {
  return view(z.string().regex(/^\d+$/), "suggest_reply", { hajat_id: hajatId, guest }, options);
}

/** Whether the account has a tUSDC storage account. Unregistered accounts cannot receive tUSDC. */
export async function isTusdcRegistered(account: string, options?: RpcOptions): Promise<boolean> {
  const raw = await viewCall(env.ftId, "storage_balance_of", { account_id: account }, options);
  return raw !== null && raw !== undefined;
}
