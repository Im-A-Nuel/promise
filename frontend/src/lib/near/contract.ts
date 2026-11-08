import { z } from "zod";
import { env } from "@/lib/env";
import { viewCall, type RpcOptions } from "@/lib/near/provider";
import {
  configSchema,
  hajatSchema,
  invitationSchema,
  nftTokenSchema,
  type Config,
  type Hajat,
  type InvitationView,
  type NftToken,
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
