import { z } from "zod";

// Mirrors docs/SCHEMA.md. Amounts are decimal strings (tUSDC has 6 decimals). Times are ms.

export const hajatKind = z.enum(["Wedding", "Khitan", "Birth", "Syukuran", "Duka", "Other"]);
export const joinPolicy = z.enum(["InviteOnly", "OpenLink"]);
export const hajatStatus = z.enum(["Open", "Cancelled"]);
export const invState = z.enum(["Invited", "Sealed", "Opening", "Opened", "Refunding", "Refunded"]);
export const cardStatus = z.enum([
  "Invited",
  "Sealed",
  "Opened",
  "PartiallyRepaid",
  "Repaid",
  "Reply",
  "Refunded",
  "Void",
]);

export type HajatKind = z.infer<typeof hajatKind>;
export type JoinPolicy = z.infer<typeof joinPolicy>;
export type HajatStatus = z.infer<typeof hajatStatus>;
export type InvState = z.infer<typeof invState>;
export type CardStatus = z.infer<typeof cardStatus>;

const amount = z.string().regex(/^\d+$/);

export const configSchema = z.object({
  owner: z.string(),
  ft: z.string(),
  app_url: z.string(),
  hajat_count: z.number().int().nonnegative(),
  token_count: z.number().int().nonnegative(),
});
export type Config = z.infer<typeof configSchema>;

export const hajatSchema = z.object({
  id: z.number().int().positive(),
  host: z.string(),
  title: z.string(),
  kind: hajatKind,
  venue: z.string(),
  event_at_ms: z.number().int().nonnegative(),
  join_policy: joinPolicy,
  status: hajatStatus,
  invite_count: z.number().int().nonnegative(),
  sealed_total: amount,
  released_total: amount,
  created_at_ms: z.number().int().nonnegative(),
});
export type Hajat = z.infer<typeof hajatSchema>;

export const invitationSchema = z.object({
  token_id: z.number().int().positive(),
  hajat_id: z.number().int().positive(),
  owner: z.string(),
  label: z.string(),
  note: z.string(),
  state: invState,
  card_status: cardStatus,
  sealed: amount,
  released: amount,
  settled: amount,
  reciprocated: amount,
  checked_in: z.boolean(),
  created_at_ms: z.number().int().nonnegative(),
  sealed_at_ms: z.number().int().nullable(),
  opened_at_ms: z.number().int().nullable(),
  repays: z.array(z.tuple([z.number().int(), amount])),
});
export type InvitationView = z.infer<typeof invitationSchema>;

export const nftTokenSchema = z.object({
  token_id: z.string(),
  owner_id: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    media: z.string().nullable(),
    issued_at: z.string().nullable(),
    reference: z.string().nullable(),
    extra: z.string().nullable(),
  }),
  approved_account_ids: z.record(z.string(), z.number()).nullable(),
});
export type NftToken = z.infer<typeof nftTokenSchema>;

export const healthSchema = z.object({
  ok: z.literal(true),
  network: z.literal("testnet"),
  amplop: z.string(),
  ft: z.string(),
  block_height: z.number().int(),
  deployed: z.boolean(),
});
export type Health = z.infer<typeof healthSchema>;

export const ledgerRowSchema = z.object({
  counterparty: z.string(),
  remaining: amount,
  token_ids: z.array(z.string().regex(/^\d+$/)),
});
export type LedgerRow = z.infer<typeof ledgerRowSchema>;

export const ledgerSchema = z.object({
  /** The counterparty owes me. */
  owed_to_me: z.array(ledgerRowSchema),
  /** I owe the counterparty. */
  i_owe: z.array(ledgerRowSchema),
});
export type Ledger = z.infer<typeof ledgerSchema>;

export const pairSchema = z.object({
  remaining: amount,
  open: z.array(z.string().regex(/^\d+$/)),
});
export type Pair = z.infer<typeof pairSchema>;

export const eventsSchema = z.object({ events: z.array(hajatSchema) });
export type EventsResponse = z.infer<typeof eventsSchema>;

/** An invitation plus the card the contract drew for it (a data URI), or null if it could not be read. */
export const eventInvitationSchema = invitationSchema.extend({ media: z.string().nullable() });
export type EventInvitation = z.infer<typeof eventInvitationSchema>;

export const eventSummarySchema = z.object({
  hajat: hajatSchema,
  invitations: z.array(eventInvitationSchema),
  /** What the viewer still owes this event's host, in base units. Null when no viewer was given. */
  suggested_reply: amount.nullable(),
});
export type EventSummary = z.infer<typeof eventSummarySchema>;

export const balanceSchema = z.object({ tusdc: amount, registered: z.boolean() });
export type BalanceResponse = z.infer<typeof balanceSchema>;
