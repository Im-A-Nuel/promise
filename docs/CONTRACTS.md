# Smart Contract Specification

Last updated: 2026-11-09. Applies to `contract/amplop` and `contract/tusdc`. If code and this file disagree, fix one of them in the same commit.

Snippets below show shape, not final code. near-sdk 5.x APIs: `#[near(contract_state)]`, `#[near(serializers=[json, borsh])]`, `near_sdk::store` collections, `env::block_timestamp_ms()`, `NearToken`.

## 1. Accounts and wiring

| Contract | Testnet account | Init |
| --- | --- | --- |
| tusdc | `tusdc.promisedemo.testnet` | `new(owner_id)` |
| amplop | `amplop.promisedemo.testnet` | `new(owner_id, ft_id, app_url)` with `ft_id = tusdc...` |

`amplop` accepts exactly one token, the `ft_id` fixed at init. There is no setter for it.

## 2. Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `MIN_AMPLOP` | 10_000 | 0.01 tUSDC, 6 decimals |
| `MAX_TITLE` | 80 | chars |
| `MAX_VENUE` | 80 | chars |
| `MAX_LABEL` | 40 | chars |
| `MAX_NOTE` | 140 | chars |
| `MAX_INVITES` | 200 | per hajat |
| `MAX_INVITE_BATCH` | 20 | per `invite_many` |
| `MAX_SETTLE` | 10 | claims repaid per open |
| `MAX_PAIR_OPEN` | 50 | open token ids per pair |
| `MAX_ACTIVITY` | 5000 | on-chain log entries |
| `MAX_PAGE` | 50 | view `limit` cap |
| `OPEN_WINDOW_MS` | 86_400_000 | host may open from `event_at - 24h` |
| `AUTO_OPEN_MS` | 86_400_000 | anyone may open after `event_at + 24h` |
| `SEAL_UNTIL_MS` | 86_400_000 | sealing allowed until `event_at + 24h` (same moment as auto-open) |
| `ABANDON_MS` | 2_592_000_000 | 30 days after `event_at`, owner may refund a still-sealed envelope |
| `MAX_EVENT_AHEAD_MS` | 31_536_000_000 | event date at most 365 days ahead |
| `GAS_FT_TRANSFER` | 30 Tgas | |
| `GAS_CALLBACK` | 25 Tgas | callbacks of `refund` |
| `GAS_CALLBACK_OPEN` | 60 Tgas | `on_open_resolved`, which also settles up to `MAX_SETTLE` claims. A callback that runs out of gas would leave the token in `Opening`, so this is deliberately generous (measured: the whole `check_in` with 10 repayments burns 12 Tgas) |
| `MIN_GAS_OPEN` | 120 Tgas | `check_in`, `open` assert `prepaid_gas` at least this |
| `MIN_GAS_REFUND` | 80 Tgas | |

## 3. State and types

```rust
#[near(contract_state)]
pub struct Contract {
    owner: AccountId,
    ft: AccountId,
    app_url: String,                           // for NEP-177 `reference`
    next_hajat: u64,                           // starts at 1
    next_token: u64,                           // starts at 1
    hajats: LookupMap<u64, Hajat>,                 // ids are 1..next_hajat
    tokens: LookupMap<u64, Invitation>,            // ids are 1..next_token
    hajat_tokens: LookupMap<(u64, u32), u64>,      // (hajat, position) -> token, length = invite_count
    invite_of: LookupMap<(u64, AccountId), u64>,   // dedupe: (hajat, guest) -> token
    owner_count: LookupMap<AccountId, u32>,        // tokens are soulbound, so lists are append-only
    owner_tokens: LookupMap<(AccountId, u32), u64>,
    host_count: LookupMap<AccountId, u32>,
    host_hajats: LookupMap<(AccountId, u32), u64>,
    pairs: LookupMap<(AccountId, AccountId), PairLedger>,  // key (giver, receiver): what the receiver owes the giver
    owed_to: PairIndex,   // giver -> receivers that owe them. Three flat maps (len, items, position), O(1) add and remove
    owes: PairIndex,      // receiver -> givers they owe
    activity: Vector<ActivityEntry>,
}

#[near(serializers=[json, borsh])]
pub struct Hajat {
    id: u64, host: AccountId, title: String, kind: HajatKind, venue: String,
    event_at_ms: u64, join_policy: JoinPolicy, status: HajatStatus,
    invite_count: u32, sealed_total: u128, released_total: u128, created_at_ms: u64,
}

#[near(serializers=[json, borsh])]
pub struct Invitation {
    token_id: u64, hajat_id: u64, owner: AccountId, label: String, note: String,
    state: InvState,
    sealed: u128,        // currently locked
    released: u128,      // moved to host when opened
    settled: u128,       // part of `released` used to repay older claims
    reciprocated: u128,  // part of `credit` the host has paid back since
    checked_in: bool,
    created_at_ms: u64, sealed_at_ms: Option<u64>, opened_at_ms: Option<u64>,
    repays: Vec<(u64, u128)>,   // (older token id, amount) this token repaid
}
// credit = released - settled     (what the host still owes this guest at the start)
// owed now = credit - reciprocated

#[near(serializers=[json, borsh])]
pub struct PairLedger { remaining: u128, open: Vec<u64> }   // oldest first

pub enum HajatKind { Wedding, Khitan, Birth, Syukuran, Duka, Other }
pub enum JoinPolicy { InviteOnly, OpenLink }
pub enum HajatStatus { Open, Cancelled }
pub enum InvState { Invited, Sealed, Opening, Opened, Refunding, Refunded }
pub enum CardStatus { Invited, Sealed, Opened, PartiallyRepaid, Repaid, Reply, Refunded, Void }
```

Why flat maps: `near_sdk::store` collections write lazily, so storage usage measured inside a method is only exact after `flush()`. Nested collections (a set inside a map) cannot be flushed from outside, which would break the storage deposit rule in section 5. Every collection here is flat and `settle_storage` flushes them all before measuring. The `owed_to` and `owes` ledger indexes in section 6 must follow the same rule.

All amounts in stored types are `U128` (decimal strings in JSON). Ids and timestamps are plain numbers.

`CardStatus` is derived for display only:

| Condition | CardStatus |
| --- | --- |
| state Invited and hajat Open | Invited |
| state Invited and hajat Cancelled | Void |
| state Sealed or Opening | Sealed |
| state Opened, credit > 0, reciprocated = 0 | Opened |
| state Opened, credit > 0, 0 < reciprocated < credit | PartiallyRepaid |
| state Opened, credit > 0, reciprocated = credit | Repaid |
| state Opened, credit = 0 (all of it repaid older claims) | Reply |
| state Refunding or Refunded | Refunded |

## 4. State machines

```
Invitation
  Invited --seal--> Sealed --seal (top-up)--> Sealed
  Sealed --check_in / open--> Opening --callback ok--> Opened
                                      --callback fail--> Sealed
  Sealed --refund (hajat cancelled, or abandoned 30d)--> Refunding --ok--> Refunded
                                                                    --fail--> Sealed

Hajat
  Open --cancel_hajat (no Opened tokens)--> Cancelled
```

Time rules (all compare against `env::block_timestamp_ms()`):

| Action | Who | When |
| --- | --- | --- |
| seal | token owner | hajat Open and `now < event_at + SEAL_UNTIL_MS` |
| check_in, open | host | `now >= event_at - OPEN_WINDOW_MS` |
| open | anyone | `now >= event_at + AUTO_OPEN_MS` |
| cancel_hajat | host | status Open and no token is Opened or Opening |
| refund | anyone (money goes to owner) | hajat Cancelled and token Sealed, or `now >= event_at + ABANDON_MS` and token Sealed |

## 5. Methods

Storage rule for every method marked payable: measure `env::storage_usage()` before and after, require `attached_deposit >= used_bytes * storage_byte_cost`, refund the excess to the caller. FE attaches 0.02 NEAR for `create_hajat` and 0.01 NEAR per invitation. Error `ERR_DEPOSIT_TOO_LOW` otherwise.

### 5.1 Writes

| Method | Caller | Payable | Preconditions | Effects | Event |
| --- | --- | --- | --- | --- | --- |
| `new(owner_id, ft_id, app_url)` | deployer | no | not initialized | sets config | none |
| `create_hajat(title, kind, venue, event_at_ms, join_policy) -> U64` | any | yes | lengths within limits, `now <= event_at_ms <= now + MAX_EVENT_AHEAD_MS` | host = predecessor, id = next_hajat | `hajat_created` |
| `set_join_policy(hajat_id, policy)` | host | no | hajat Open | updates policy | `hajat_updated` |
| `set_app_url(url)` | owner | no | caller is `owner`, url at most 120 chars | updates the base URL used in NEP-177 `reference` | none |
| `invite(hajat_id, guest, label) -> U64` | host | yes | hajat Open, `invite_count < MAX_INVITES`, guest has no invitation here | mint soulbound token to guest, state Invited | `invited`, `nft_mint` |
| `invite_many(hajat_id, items) -> Vec<U64>` | host | yes | as above, `items.len() <= MAX_INVITE_BATCH` | all or nothing | per token |
| `join(hajat_id, label) -> U64` | any | yes | policy OpenLink, hajat Open, caller has no invitation, quota left | mint to caller | `joined`, `nft_mint` |
| `ft_on_transfer(sender_id, amount, msg) -> PromiseOrValue<U128>` | `ft` only | no | see 5.2 | add to `sealed`, state Sealed | `sealed` |
| `check_in(token_id)` | host | no | state Sealed or Invited, time rule, gas >= MIN_GAS_OPEN | sets `checked_in`; if Sealed starts the open flow | `checked_in` |
| `open(token_id)` | host or anyone per time rule | no | state Sealed, gas >= MIN_GAS_OPEN | start open flow | none until callback |
| `cancel_hajat(hajat_id)` | host | no | see time table | status Cancelled | `hajat_cancelled` |
| `refund(token_id)` | any | no | see time table, gas >= MIN_GAS_REFUND | state Refunding, FT transfer to owner | none until callback |
| `on_open_resolved(token_id, amount)` | self | no | `#[private]` | see 6 | `opened`, `repaid` |
| `on_refund_resolved(token_id, amount)` | self | no | `#[private]` | state Refunded or back to Sealed | `refunded` |

Behavior notes for the implemented writes:

- A host cannot invite themselves or `join` their own hajat (`ERR_BAD_INPUT`). Their own envelope would repay themselves.
- Titles and labels must contain a non-blank character. Venue may be empty.
- `invite_many` requires 1 to 20 items and is all or nothing.
- `create_hajat` accepts `event_at_ms` equal to now. Past dates give `ERR_BAD_TIME`.
- Views take optional `from` (offset) and `limit` (default 50, max 50). `get_hajats` and `get_hajats_by_host` are newest first, `get_invitations` is oldest first.
- `get_config` returns an object `{owner, ft, app_url, hajat_count, token_count}`.
- `msg` of `ft_transfer_call` carries `token_id` as a decimal string, as in the example in 5.2. A bare number is rejected as `ERR_BAD_MSG`.
- `check_in` and `open` need the hajat to be `Open`. After `cancel_hajat` the host can no longer pull sealed money; guests get it back through `refund`.
- `check_in` and `open` assert `prepaid_gas >= MIN_GAS_OPEN` on every call, including a `check_in` that only records attendance.
- A top-up while a token is `Opening` is a soft rejection (`ERR_BAD_STATE`), so the tokens go back to the sender.
- `on_open_resolved` never panics. A panic there would leave the token stuck in `Opening`. If the token is not `Opening`, it does nothing and returns `false`.
- The `#[private]` guard lives in the generated wrapper, so it is checked in the sandbox test `callback_is_private`, not in unit tests.
- `cancel_hajat` loops over the hajat's tokens (at most 200) and refuses with `ERR_HAS_OPENED` if any is `Opened` or `Opening`. It moves no money; guests (or anyone) then call `refund`.
- `refund` needs `prepaid_gas >= MIN_GAS_REFUND` and sends the tokens to the owner. `on_refund_resolved` never panics either; a failed transfer puts the token back to `Sealed` so the refund can be retried.
- `nft_transfer` and `nft_transfer_call` are `#[payable]` so a standard wallet call with 1 yoctoNEAR reaches `ERR_SOULBOUND`.
- `nft_token(token_id)` takes the id as a string and returns `None` for an unknown or malformed id. `metadata.media` is the card from `svg.rs` as a base64 data URI, built on every call. The amount is only in `extra` and on the card once the envelope is `Opened`.
- `nft_tokens` and `nft_tokens_for_owner` take `from_index` and `limit` (capped at 50).
- The contract pays for the bytes a seal adds (the note and `sealed_at_ms`, at most about 150 bytes per token), because `ft_on_transfer` cannot receive a deposit. Keep the contract account funded as described in section 11.

`check_in` on an Invited token (guest came but sealed nothing) only records attendance. It does not move money.

`nft_transfer` and `nft_transfer_call` always panic with `ERR_SOULBOUND`.

### 5.2 `ft_on_transfer`

```
msg JSON: {"token_id":"7","note":"Selamat ya, semoga sakinah"}   (note optional, max 140 chars)
```

1. `predecessor == ft`, else panic `ERR_WRONG_TOKEN`.
2. Parse `msg`. If invalid, return `U128(amount)` (full refund) and log `ERR_BAD_MSG`.
3. Load token. If missing, return `U128(amount)`.
4. Soft rejections, each returns `U128(amount)` and logs the code: `sender != owner` (`ERR_NOT_SENDER_OWNER`), hajat not Open (`ERR_HAJAT_NOT_OPEN`), state not Invited or Sealed (`ERR_BAD_STATE`), `now >= event_at + SEAL_UNTIL_MS` (`ERR_TOO_LATE`), `amount < MIN_AMPLOP` (`ERR_TOO_SMALL`).
5. Success: `token.sealed += amount`, `hajat.sealed_total += amount`, state Sealed, store note if provided, set `sealed_at_ms` on the first seal. Return `U128(0)`.

Soft rejections matter. A panic inside `ft_on_transfer` also refunds through `ft_resolve_transfer`, but returning the amount keeps logs readable and avoids wasted gas.

### 5.3 Open flow

```rust
fn start_open(&mut self, token_id: u64) -> Promise {
    // checks done by caller: auth, time window, state == Sealed, prepaid gas
    let t = self.token_mut(token_id);
    let amount = t.sealed;
    t.state = InvState::Opening;
    ext_ft::ext(self.ft.clone())
        .with_attached_deposit(NearToken::from_yoctonear(1))
        .with_static_gas(GAS_FT_TRANSFER)
        .ft_transfer(host, U128(amount), Some("amplop".into()))
        .then(Self::ext(env::current_account_id())
            .with_static_gas(GAS_CALLBACK)
            .on_open_resolved(token_id, U128(amount)))
}
```

`on_open_resolved`:

```
require promise_results_count() == 1
match promise_result(0):
  Failed  -> token.state = Sealed; emit `open_failed`; return
  Success ->
    token.state = Opened; token.released = amount; token.sealed = 0
    token.opened_at_ms = now; hajat.sealed_total -= amount; hajat.released_total += amount
    settle(token)            // section 6
    emit `opened`
```

Refund flow mirrors this with `Refunding`, sends to `token.owner`, and on success sets `Refunded`, `sealed = 0`, `hajat.sealed_total -= amount`.

## 6. Ledger

Claim semantics. When a guest G gives an envelope of `A` at the hajat of host H and it opens, H owes G `A` as a debt of honor. Stored as pair `(giver = G, receiver = H)`.

`settle(T)` runs after the money moved, with `G = T.owner`, `H = host`, `A = T.released`:

```
remaining = A
older = pairs[(giver = H, receiver = G)]        // what G owes H from H's earlier gifts to G
iterations = 0
for id in older.open (oldest first):
    if remaining == 0 or iterations == MAX_SETTLE: break
    c = tokens[id]
    need = (c.released - c.settled) - c.reciprocated
    pay = min(need, remaining)
    c.reciprocated += pay; older.remaining -= pay; remaining -= pay
    T.settled += pay; T.repays.push((id, pay))
    if c fully repaid: drop id from older.open
    iterations += 1
if older.remaining == 0: delete the pair and unlink owed_to[H] / owes[G]
credit = A - T.settled
if credit > 0:
    pair = pairs[(giver = G, receiver = H)]    // create if missing
    if pair.open.len() >= MAX_PAIR_OPEN: emit `claim_skipped`   // documented limit
    else: pair.open.push(T.id); pair.remaining += credit; link owed_to[G] and owes[H]
emit `repaid` for every entry in T.repays
```

Invariants (assert them in tests):

1. For every token: `settled <= released`, `reciprocated <= released - settled`.
2. For every pair: `remaining == sum over open ids of (released - settled - reciprocated)`.
3. `hajat.released_total` equals the sum of `released` of its tokens.
4. Total tUSDC held by the contract equals the sum of `sealed` over all tokens (plus nothing else).
5. A token is in `pairs[..].open` if and only if it is Opened and has owed > 0.

Worked example, all amounts in tUSDC:

| Step | Event | Result |
| --- | --- | --- |
| 1 | Ayu hosts H1. Budi seals 5, Ayu opens | pair `budi|ayu` remaining 5 (Ayu owes Budi 5) |
| 2 | Same for Citra with 2 | pair `citra|ayu` remaining 2 |
| 3 | Budi hosts H2. Ayu seals 5, Budi opens | looks up `budi|ayu`, repays token 1 fully. New token: settled 5, credit 0, status Reply. Pair removed |
| 4 | Instead Ayu seals 8 | repays 5, credit 3, new pair `ayu|budi` remaining 3 (Budi now owes Ayu 3) |
| 5 | Instead Ayu seals 3 | repays 3, pair `budi|ayu` remaining 2, token 1 status PartiallyRepaid |

## 7. Dynamic NFT

Standards: NEP-171 (`nft_token`, `nft_tokens_for_owner`, `nft_tokens`, `nft_total_supply`, `nft_supply_for_owner`), NEP-177 (`nft_metadata`), NEP-297 for events. Approvals are not implemented.

`nft_token(token_id) -> Option<JsonToken>`:

```json
{
  "token_id": "7",
  "owner_id": "dewi.promisedemo.testnet",
  "metadata": {
    "title": "Invitation #7: Pernikahan Ayu & Bima",
    "description": "Sealed. Opens at the event.",
    "media": "data:image/svg+xml;base64,PHN2Zy...",
    "reference": "https://TODO(deploy)/api/nft/7",
    "extra": "{\"hajat_id\":1,\"status\":\"Sealed\",\"released\":\"0\",\"reciprocated\":\"0\"}"
  },
  "approved_account_ids": null
}
```

`media` comes from `render_svg(&Invitation, &Hajat) -> String`, base64-encoded with the `base64` crate (no_std alloc features).

Card layout (viewBox 360x220): cream background `#FBF7F0`, red envelope `#9B1C1C`, gold trim `#C9A227`, text `#3A2A1A`. Always shows guest label, hajat title (truncated to 28 chars), token number. Per status:

| Status | Visual |
| --- | --- |
| Invited | Open flap, empty envelope, ribbon "INVITED" |
| Sealed | Closed flap with wax seal, ribbon "SEALED", amount hidden |
| Opened | Flap up, gold coin, amount "5.00 tUSDC", ribbon "WAITING FOR ITS ANSWER" |
| PartiallyRepaid | As Opened plus a progress bar (reciprocated / credit) |
| Repaid | Green check on the envelope, ribbon "REPAID" |
| Reply | Two arrows forming a loop, text "Repaid N envelopes" |
| Refunded | Faded envelope, ribbon "RETURNED" |
| Void | Grey envelope, ribbon "EVENT CANCELLED" |

Escape every user string (`& < > " '`) before inserting into SVG. Output must stay under 2 KB.

## 8. Events and activity log

NEP-297 envelope, one line per event:

```
EVENT_JSON:{"standard":"promise_amplop","version":"1.0.0","event":"opened","data":[{"hajat_id":"1","token_id":"3","host":"ayu...","guest":"budi...","amount":"5000000"}]}
```

Events: `hajat_created`, `hajat_updated`, `hajat_cancelled`, `invited`, `joined`, `sealed`, `checked_in`, `opened`, `open_failed`, `repaid`, `claim_skipped`, `refunded`, `refund_failed`. Mints also emit the NEP-171 `nft_mint` event with `standard: "nep171"`.

On-chain log: `ActivityEntry { idx: u32, at_ms: u64, kind: String, hajat_id: u64, token_id: u64, actor: AccountId, amount: U128 }`. Appended in the same call as the event until `MAX_ACTIVITY`. Read with `get_activity(from, limit)`.

## 9. Views

| Method | Returns |
| --- | --- |
| `get_config()` | `{owner, ft, app_url, hajat_count, token_count}` |
| `get_hajat(hajat_id)` | `Option<Hajat>` |
| `get_hajats_by_host(host, from, limit)` | `Vec<Hajat>` |
| `get_hajats(from, limit)` | newest first, for the demo landing list |
| `get_invitations(hajat_id, from, limit)` | `Vec<InvitationView>` (token plus `card_status`) |
| `get_invitation(token_id)` | `Option<InvitationView>` |
| `get_invitation_for(hajat_id, account)` | `Option<InvitationView>` |
| `get_ledger(account_id, from?, limit?)` | `{ owed_to_me: Vec<LedgerRow>, i_owe: Vec<LedgerRow> }`. `from` and `limit` page each list separately (limit max 50) |
| `get_pair(giver, receiver)` | `{ remaining: U128, open: Vec<U64> }` |
| `suggest_reply(hajat_id, guest)` | `U128`, equals `get_pair(host_of_hajat, guest).remaining` |
| `get_activity(from, limit)` | `Vec<ActivityEntry>` |
| `nft_*` | per NEP-171, NEP-177 |

`LedgerRow { counterparty: AccountId, remaining: U128, token_ids: Vec<U64> }`. In `owed_to_me` the counterparty owes me. In `i_owe` I owe the counterparty.

## 10. Errors

All `&'static str`, prefix `ERR_`: `NOT_HOST`, `NOT_OWNER`, `HAJAT_NOT_FOUND`, `TOKEN_NOT_FOUND`, `HAJAT_NOT_OPEN`, `INVITE_ONLY`, `ALREADY_INVITED`, `QUOTA_FULL`, `BAD_INPUT`, `BAD_TIME`, `DEPOSIT_TOO_LOW`, `WRONG_TOKEN`, `BAD_MSG`, `NOT_SENDER_OWNER`, `BAD_STATE`, `TOO_SMALL`, `TOO_EARLY`, `TOO_LATE`, `HAS_OPENED`, `SOULBOUND`, `NOT_REFUNDABLE`, `PRIVATE`, `GAS`, `OVERFLOW`.

## 11. Gas and storage budget

| Call | Expected | Prepaid by client |
| --- | --- | --- |
| `create_hajat`, `invite`, `join` | under 10 Tgas | 30 Tgas |
| `ft_transfer_call` into `ft_on_transfer` | under 35 Tgas combined | 100 Tgas |
| `check_in` / `open` with 10 repayments | under 110 Tgas | 150 Tgas |
| `refund` | under 70 Tgas | 100 Tgas |
| any view | under 50 Tgas | n/a |

Storage per invitation is roughly 450 bytes (about 0.0045 NEAR). Contract account should hold at least 5 NEAR for headroom.

## 12. Test plan

Unit tests (pure functions, no VM): `settle`, `render_svg` escaping and size, `card_status`, input validation. Sandbox tests with `near-workspaces`: deploy `tusdc` and `amplop`, create accounts, drive the flows, use `fast_forward` for time rules.

| ID | Scenario | Expect |
| --- | --- | --- |
| T-01 | create hajat with valid input | id 1, `get_hajat` matches, deposit refunded |
| T-02 | title empty or over 80 | `ERR_BAD_INPUT` |
| T-03 | event date in the past or over 365 days | `ERR_BAD_TIME` |
| T-04 | invite guest | token minted, owner is guest, `invite_count` 1 |
| T-05 | invite same guest twice | `ERR_ALREADY_INVITED` |
| T-06 | invite by non-host | `ERR_NOT_HOST` |
| T-07 | 201st invitation | `ERR_QUOTA_FULL` |
| T-08 | `invite_many` with 21 items | `ERR_BAD_INPUT`, nothing minted |
| T-09 | join on InviteOnly | `ERR_INVITE_ONLY` |
| T-10 | join on OpenLink, join twice | first ok, second `ERR_ALREADY_INVITED` |
| T-11 | seal 5 tUSDC with note | state Sealed, `sealed` 5, note stored |
| T-12 | seal then top-up 2 | `sealed` 7 |
| T-13 | seal from a non-owner | tokens returned to sender, state unchanged |
| T-14 | seal below minimum | tokens returned |
| T-15 | `ft_on_transfer` called by a stranger | panic `ERR_WRONG_TOKEN` |
| T-16 | host check_in before window | `ERR_TOO_EARLY` |
| T-17 | host check_in in window | Opened, host balance +amount, `released_total` updated |
| T-18 | stranger opens before auto window | `ERR_TOO_EARLY`; at `event_at + 24h` succeeds. Sandbox checks the rejection, the exact boundary is a unit test because `fast_forward` over 24 hours of blocks does not finish in reasonable time |
| T-19 | host not registered on tusdc | open fails, state back to Sealed, tokens still in contract |
| T-20 | first gift, no older claim | credit = amount, pair created, `owed_to`/`owes` linked |
| T-21 | reply exactly equals debt | `settled` = amount, credit 0, status Reply, older token Repaid, pair removed |
| T-22 | reply larger than debt | older Repaid, new pair in the opposite direction with the surplus |
| T-23 | reply smaller than debt | older PartiallyRepaid, pair remaining reduced |
| T-24 | two older claims, one reply covering both | oldest repaid first, `repays` lists both |
| T-25 | 12 older claims, big reply | only 10 repaid, remainder stays owed or becomes credit, no gas failure |
| T-26 | invariants 1 to 5 after a random sequence of 50 operations | all hold (property test) |
| T-27 | `suggest_reply` equals `get_pair(host, guest).remaining` | equal |
| T-28 | `nft_transfer` and `nft_transfer_call` | `ERR_SOULBOUND` |
| T-29 | `nft_token` for each status | `media` decodes to valid SVG, `extra` JSON matches state |
| T-30 | user label with `<script>` and quotes | escaped in SVG, size under 2 KB |
| T-31 | `nft_tokens_for_owner` pagination | correct slices, limit capped at 50 |
| T-32 | cancel hajat with only Sealed tokens | Cancelled; `refund` returns money to owner, not caller |
| T-33 | cancel after one Opened | `ERR_HAS_OPENED` |
| T-34 | refund when hajat Open and not abandoned | `ERR_NOT_REFUNDABLE` |
| T-35 | refund after 30 days still Sealed | succeeds |
| T-36 | refund callback failure (owner unregistered) | state back to Sealed |
| T-37 | `tusdc` faucet twice within 6 hours | second call fails with cooldown error |
| T-38 | `tusdc` faucet registers a new account | balance 100, can seal without `storage_deposit` |
| T-39 | deposit too low on `create_hajat` | `ERR_DEPOSIT_TOO_LOW`, state unchanged |
| T-40 | gas report for open with 10 repayments | under 120 Tgas, recorded in the PR description |

## 13. tusdc contract

NEP-141 via near-contract-standards `FungibleToken`, metadata `{spec: "ft-1.0.0", name: "Test USDC (Promise)", symbol: "tUSDC", decimals: 6}`.

Extra methods:

| Method | Behavior |
| --- | --- |
| `faucet() -> U128` | Mints 100 tUSDC (100_000_000 units) to the caller. Registers the caller if needed, paid from the contract balance. One call per account per 6 hours, else panics `ERR_COOLDOWN` |
| `faucet_next_at(account_id) -> U64` | ms timestamp when the account may claim again |
| `mint(account_id, amount)` | Owner only, used by `seed.ts` to fund personas |

No burn, no pause, no upgrade path. Testnet toy.

## 14. Deploy and upgrade notes

- Build with `cargo near build non-reproducible-wasm` during development. Final submission build can be reproducible if Docker is available, but this is optional.
- State is not migrated. A redeploy during the hackathon means re-running `seed.ts`. Freeze the contract on 2026-11-13 and do not touch it after.
- After the final deploy, deleting the full access key of `amplop` is optional and irreversible. Only do it if you are sure no further deploys are needed.

## 15. Notes from implementing the ledger and the card

- Settlement runs in `on_open_resolved` after the FT transfer succeeded. A failed transfer leaves the ledger untouched (sandbox test `host_not_registered_leaves_the_ledger_untouched`).
- The contract account pays for the ledger bytes, because a callback cannot receive a deposit. This is at most one pair entry, two index entries and the changes to older tokens per opening. Keep the contract account funded as in section 11.
- A claim that cannot be added because the pair already has `MAX_PAIR_OPEN` open claims is not recorded. The card of that token then stays `Opened` and is never repaid. This is the documented limit; the `claim_skipped` event marks it.
- `repaid` event data: `hajat_id`, `token_id` (the new token), `older_token_id`, `giver`, `receiver`, `amount`.
- Both directions of a pair can hold claims at the same time. When a reply is larger than `MAX_SETTLE` claims can absorb, the old pair keeps its remainder and the leftover credit opens the opposite pair (unit test T-25).
- Card layout: SVG viewBox 360x220 using the palette in section 7. The `Opened` and `PartiallyRepaid` footer shows the released amount; `Reply` shows "Repaid N envelope(s)". Label is cut to 16 characters and the hajat title to 28, then escaped. If the result would reach 2048 bytes a minimal card with no user text is returned instead.
- Measured: `nft_token` size and the worst case escaping case are tests (T-30). Wasm size after this phase: `amplop` 307 KB.
- T-26 is four tests (one per seed). The mocked storage of unit tests lives per thread, so a second `Contract::new` inside one test would start on the first one's data.

## 16. Pre-deploy review (self-review, not an independent audit)

| ID | Finding | Status |
| --- | --- | --- |
| F-1 | The open callback grows storage that the contract account pays for. With a thin balance it fails after the tUSDC already moved, and the token is stuck in `Opening` with no way out. Reproduced in `sandbox_security.rs` (host received 5 tUSDC, state `Opening`). | Fixed. `start_open` requires `MIN_SPARE_BALANCE` (0.1 NEAR) of spare balance and fails with `ERR_LOW_BALANCE` before any state change. `ft_on_transfer` hands the tokens back for the same reason. `get_config().spare_balance` exposes the number so a monitor can top up. |
| F-2 | Gas of the heaviest view. | `nft_tokens(limit 50)` burns 15 Tgas, far below the 200 Tgas view limit. No change. |
| F-3 | The contract owner keeps the full access key of the `amplop` account, so the owner could redeploy code and move escrowed tUSDC. | Accepted for testnet and stated in the README. Optional: delete the key after the final deploy (irreversible, section 14). |
| F-4 | The `tusdc` faucet registers each new account at the contract's cost (about 0.00125 NEAR). Many throwaway accounts can drain it. | Accepted, testnet token. Fund `tusdc` with at least 4 NEAR and top it up if the faucet stops answering. |
| F-5 | A host can invite any account, so a victim sees an unwanted soulbound card in their wallet. The host pays the storage. | Accepted. No transfer or approval can move it, and it holds no money. |
| F-6 | A guest can fill their own pair with 50 dust claims, after which a further gift is not recorded (`claim_skipped`). | Accepted, documented limit. Only the filling guest loses the record. |
| F-7 | A seal adds at most about 150 bytes (note and timestamp) paid by the contract. | Accepted. A joined guest pays about three times that for the invitation itself, so this cannot drain the contract, and F-1 stops sealing when the balance is low. |

Checked and found sound: `ft_on_transfer` accepts only the configured token and only the invitation owner; no method can move money to anyone but the host (open) or the token owner (refund); `Opening` and `Refunding` block seal, cancel, a second open and a second refund; callbacks are `#[private]`, never panic on a failed transfer, and are idempotent on a token that is no longer locked; settlement is bounded (10 claims, 50 per pair, 200 invitations); all counters use checked or saturating arithmetic with release overflow checks on (the only overflow found was in the card progress bar, fixed earlier).

Funding rule for deploy: `amplop` needs about 3.1 NEAR just to hold its code, plus at least 0.1 NEAR spare (F-1). The runbook budget of 8 NEAR leaves enough room.
