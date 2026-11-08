# Data and API Design

Last updated: 2026-11-09.

## Database

None, by design (ARCHITECTURE.md decision D6). State lives in the `amplop` and `tusdc` contracts. The web app caches reads for 10 seconds in route handlers using the Next.js fetch cache. If a database is added later, it must be a read cache that can be rebuilt from the contract and the activity log.

## On-chain types (JSON as seen by clients)

Rule: every u128 amount is a decimal string. Every timestamp is milliseconds since epoch as a number. tUSDC has 6 decimals, so `"5000000"` means 5.00.

These TypeScript types live in `web/src/lib/near/types.ts` and are mirrored from `docs/CONTRACTS.md`.

```ts
export type HajatKind = "Wedding" | "Khitan" | "Birth" | "Syukuran" | "Duka" | "Other";
export type JoinPolicy = "InviteOnly" | "OpenLink";
export type HajatStatus = "Open" | "Cancelled";
export type InvState = "Invited" | "Sealed" | "Opening" | "Opened" | "Refunding" | "Refunded";
export type CardStatus =
  | "Invited" | "Sealed" | "Opened" | "PartiallyRepaid"
  | "Repaid" | "Reply" | "Refunded" | "Void";

export interface Hajat {
  id: number;
  host: string;
  title: string;
  kind: HajatKind;
  venue: string;
  event_at_ms: number;
  join_policy: JoinPolicy;
  status: HajatStatus;
  invite_count: number;
  sealed_total: string;
  released_total: string;
  created_at_ms: number;
}

export interface InvitationView {
  token_id: number;
  hajat_id: number;
  owner: string;
  label: string;
  note: string;
  state: InvState;
  card_status: CardStatus;
  sealed: string;
  released: string;
  settled: string;
  reciprocated: string;
  checked_in: boolean;
  created_at_ms: number;
  sealed_at_ms: number | null;
  opened_at_ms: number | null;
  repays: [number, string][];
}

export interface LedgerRow {
  counterparty: string;
  remaining: string;
  token_ids: number[];
}

export interface Ledger {
  owed_to_me: LedgerRow[];
  i_owe: LedgerRow[];
}

export interface ActivityEntry {
  idx: number;
  at_ms: number;
  kind: string;
  hajat_id: number;
  token_id: number;
  actor: string;
  amount: string;
}

export interface NftToken {
  token_id: string;
  owner_id: string;
  metadata: {
    title: string;
    description: string;
    media: string;        // data:image/svg+xml;base64,...
    reference: string;    // https://APP/api/nft/{id}
    extra: string;        // JSON string, see CONTRACTS.md section 7
  };
  approved_account_ids: null;
}
```

Call arguments (what `lib/near/contract.ts` sends):

```ts
create_hajat: { title: string; kind: HajatKind; venue: string; event_at_ms: number; join_policy: JoinPolicy }
set_join_policy: { hajat_id: number; policy: JoinPolicy }
invite: { hajat_id: number; guest: string; label: string }
invite_many: { hajat_id: number; items: { guest: string; label: string }[] }
join: { hajat_id: number; label: string }
check_in: { token_id: number }
open: { token_id: number }
cancel_hajat: { hajat_id: number }
refund: { token_id: number }
// sealing goes through tusdc:
ft_transfer_call: { receiver_id: AMPLOP; amount: string; msg: string /* JSON {"token_id":"7","note":"..."} */ }
faucet: {}
storage_deposit: { account_id: string; registration_only: true }
```

## HTTP API (Next.js route handlers)

Base URL: `http://localhost:3000` locally, `TODO(deploy): APP_URL` in production. All responses are JSON unless stated. No authentication: every endpoint exposes data that is already public on chain, except `/api/relay` which is rate limited (P2).

### Error format

```json
{ "error": { "code": "BAD_REQUEST", "message": "token_id must be a positive integer" } }
```

Codes: `BAD_REQUEST` (400), `NOT_FOUND` (404), `RATE_LIMITED` (429), `RPC_ERROR` (502), `INTERNAL` (500). Input is validated with Zod. RPC failures try the fallback endpoint once before returning 502.

### GET /api/health

- Description: liveness and chain wiring check.
- Response 200: `{ "ok": true, "network": "testnet", "amplop": "amplop.promisedemo.testnet", "ft": "tusdc.promisedemo.testnet", "block_height": 123456789 }`
- Errors: 502 if the RPC is unreachable.

### GET /api/hajat/:id/summary

- Description: hajat plus invitations in one round trip, for the host page.
- Params: `id` positive integer. Query: `from` (default 0), `limit` (default 50, max 50).
- Response 200: `{ "hajat": Hajat, "invitations": InvitationView[], "totals": { "invited": 3, "sealed": 2, "opened": 1 } }`
- Cache: 10 s.
- Errors: 404 if the hajat does not exist.

### GET /api/ledger/:account

- Description: `get_ledger` for any account.
- Response 200: `Ledger`
- Cache: 10 s. Errors: 400 if the account id is malformed.

### GET /api/nft/:tokenId

- Description: NEP-177 style JSON for wallets and marketplaces. This is the URL stored in the token's `reference` field.
- Response 200: `{ "title", "description", "media": "https://APP/api/nft/{id}/image.svg", "attributes": [{ "trait_type": "status", "value": "Sealed" }, { "trait_type": "hajat", "value": "Pernikahan Ayu & Bima" }] }`
- Errors: 404 if the token does not exist.

### GET /api/nft/:tokenId/image.svg

- Description: the SVG decoded from the contract's `media` field. Content-Type `image/svg+xml`. Not generated by the server.
- Cache: `public, max-age=15`.

### GET /api/og/hajat/:id and GET /api/og/invitation/:tokenId

- Description: 1200x630 PNG share image built with `next/og`. Used in `<meta property="og:image">` of `/h/:id` and `/invitation/:id`.
- Response 200: `image/png`. Cache 60 s. Errors: 404.

### GET /api/demo/personas

- Description: public persona list for the demo switcher. Keys are testnet only and intentionally published.
- Response 200: `{ "personas": [{ "id": "ayu", "name": "Ayu", "role": "Host", "account_id": "ayu.promisedemo.testnet", "blurb": "Hosts the wedding", "secret_key": "ed25519:..." }] }`
- The same data is bundled client-side from `web/src/lib/demo/personas.public.json`, so the endpoint is a convenience for scripts.

### POST /api/relay (P2)

- Description: submits a signed NEP-366 delegate action and pays gas from `relayer.promisedemo.testnet`.
- Request body: `{ "signed_delegate_base64": "..." }`
- Validation: decode, check `receiver_id` is `amplop` or `tusdc`; every action is a `FunctionCall` whose `method_name` is in `["ft_transfer_call","storage_deposit","join","faucet"]`; `max_block_height` within 100 blocks; sender key exists on chain; relayer balance above 2 NEAR.
- Rate limit: 20 requests per sender per hour (in-memory map, resets on cold start, acceptable for testnet).
- Response 200: `{ "tx_hash": "..." }`. Errors: 400, 429, 502.

## Environment variables

`web/.env.example`:

```
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://test.rpc.fastnear.com
NEXT_PUBLIC_RPC_FALLBACK_URL=https://rpc.testnet.near.org
NEXT_PUBLIC_AMPLOP_ID=amplop.promisedemo.testnet
NEXT_PUBLIC_FT_ID=tusdc.promisedemo.testnet
NEXT_PUBLIC_EXPLORER_URL=https://testnet.nearblocks.io
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=en
# P2 only
RELAYER_ACCOUNT_ID=relayer.promisedemo.testnet
RELAYER_PRIVATE_KEY=
```

`.env.deploy` (never committed, used by `scripts/`):

```
ROOT_ACCOUNT=promisedemo.testnet
ROOT_PRIVATE_KEY=ed25519:...
NETWORK=testnet
```

`RELAYER_PRIVATE_KEY` and `ROOT_PRIVATE_KEY` are the only real secrets. Persona keys are public and live in `web/src/lib/demo/personas.public.json`.

## Contract interface index

Full behavior is in `docs/CONTRACTS.md`. Method names the web client may call:

| Contract | Writes | Views |
| --- | --- | --- |
| amplop | `create_hajat`, `set_join_policy`, `invite`, `invite_many`, `join`, `check_in`, `open`, `cancel_hajat`, `refund` | `get_config`, `get_hajat`, `get_hajats`, `get_hajats_by_host`, `get_invitations`, `get_invitation`, `get_invitation_for`, `get_ledger`, `get_pair`, `suggest_reply`, `get_activity`, `nft_token`, `nft_tokens_for_owner`, `nft_supply_for_owner`, `nft_total_supply`, `nft_metadata` |
| tusdc | `faucet`, `ft_transfer_call`, `ft_transfer`, `storage_deposit` | `ft_balance_of`, `ft_metadata`, `faucet_next_at`, `storage_balance_of` |

Events emitted by amplop are listed in CONTRACTS.md section 8. Indexers should match on `standard == "promise_amplop"`.
