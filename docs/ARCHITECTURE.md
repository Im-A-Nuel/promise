# System Architecture

Last updated: 2026-11-09.

## Overview

Promise is a thin web app on top of one NEAR smart contract. The chain is the only source of truth. The web app reads contract views, signs transactions with either a real wallet or a demo persona, and serves a few helper endpoints (metadata, share images). There is no database and no long-running server.

Three on-chain pieces:

1. `amplop`: hajats (events), invitation NFTs, escrow balances, and the gift ledger. One contract, one account.
2. `tusdc`: a test stablecoin (NEP-141, 6 decimals) with a rate-limited faucet. Exists only because testnet has no stable USDC we control.
3. NEAR itself: accounts, storage staking, function call keys.

## System diagram

```
                    +---------------------------+
                    |  Browser (Next.js client) |
                    |  - pages, TanStack Query  |
                    |  - AppSigner interface    |
                    +------+-------------+------+
                           |             |
        wallet signing     |             | demo persona signing
   (@hot-labs/near-connect)|             | (in-browser KeyPair)
                           v             v
                    +---------------------------+        +----------------------+
                    |     NEAR testnet RPC      |<-------|  Next.js route       |
                    |  test.rpc.fastnear.com    | views  |  handlers (server)   |
                    +------+-------------+------+        |  /api/nft  /api/og   |
                           |             |               |  /api/hajat /ledger  |
                           v             v               |  /api/relay (P2)     |
              +----------------+   +----------------+    +----------------------+
              | amplop.        |   | tusdc.         |
              | promisedemo    |<--| promisedemo    |
              | .testnet       |   | .testnet       |
              | hajats, NFTs,  |   | ft_transfer_   |
              | escrow, ledger |   | call -> ft_on_ |
              +----------------+   | transfer       |
                                   +----------------+

   scripts/ (tsx): deploy, seed, demo  -> same RPC, same contracts, demo persona keys
```

## Tech stack

### Smart contracts

| Item | Choice | Why |
| --- | --- | --- |
| Language | Rust | First-class on NEAR, small wasm |
| SDK | near-sdk 5.x (pin the latest 5.x at install, the NEAR docs currently show 5.29.1) | Current major, `#[near]` macros |
| Standards | near-contract-standards for NEP-141 receiver and FT in `tusdc`; NEP-171 and NEP-177 written by hand in `amplop` | We need soulbound plus dynamic metadata, the stock `NonFungibleToken` fights that |
| Build and deploy | cargo-near | Official tool, optimized wasm |
| Tests | cargo unit tests plus near-workspaces sandbox | Sandbox supports fast-forward for time rules |
| Collections | `near_sdk::store::{LookupMap, IterableMap, IterableSet, Vector}` | Non-deprecated in 5.x |

### Web (frontend and backend in one app)

| Item | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router, TypeScript strict | Your strongest stack, route handlers cover the backend |
| Styling | Tailwind CSS v4, shadcn/ui | Fast, accessible primitives |
| Data | TanStack Query | Polling, cache, optimistic state |
| Motion | Framer Motion | Envelope opening animation |
| NEAR client | near-api-js (modular API: `Account`, `JsonRpcProvider`, `near-api-js/nep413`) | Official, supports delegate actions |
| Wallets | @hot-labs/near-connect 0.11.x, optional near-connect-hooks | Successor to wallet-selector, many wallets, sandboxed |
| Validation | Zod | All route input and env |
| QR | qrcode.react (render), a React QR scanner package (read), verify at install | Door check-in |
| i18n | Plain JSON dictionaries and a tiny `t()` helper | Avoids a heavy library for two languages |
| Hosting | Vercel (free tier) | One click from GitHub |
| CI | GitHub Actions | Contract tests, typecheck, build |

### Backend (route handlers)

No database. Route handlers do four jobs: cache contract reads, serve NFT metadata and share images, expose demo persona info, and relay delegate actions (P2). Full list in SCHEMA.md.

### Blockchain environment

| Item | Value |
| --- | --- |
| Network | NEAR testnet |
| RPC | `https://test.rpc.fastnear.com`, fallback `https://rpc.testnet.near.org` |
| Explorer | `https://testnet.nearblocks.io` |
| Root account | `promisedemo.testnet` (change via `.env.deploy` if taken) |
| Contracts | `amplop.promisedemo.testnet`, `tusdc.promisedemo.testnet` |
| Personas | `ayu`, `budi`, `citra`, `dewi`, `eko` under `promisedemo.testnet` |
| Relayer (P2) | `relayer.promisedemo.testnet` |

## Core flows

### Seal an envelope

```
Guest wallet --ft_transfer_call(amplop, amount, msg{token_id,note}) + 1 yocto--> tusdc
tusdc --ft_on_transfer(sender, amount, msg)--> amplop
amplop: checks predecessor == tusdc, sender == token owner, hajat Open, state in {Invited, Sealed}
amplop: token.sealed += amount, state = Sealed, emits `sealed`
amplop returns U128(0)  (nothing unused)
tusdc: ft_resolve_transfer, keeps the tokens in amplop's balance
```

### Open an envelope (two phase)

```
Host --check_in(token_id)--> amplop
amplop: checks time window and caller, state must be Sealed
amplop: state = Opening  (locks the token)
amplop --ft_transfer(host, amount) + 1 yocto--> tusdc
amplop --then--> on_open_resolved(token_id, amount)   [#[private]]
  success: state = Opened, released = amount
           settle ledger (repay older claims, oldest first, max 10)
           add remaining credit as a new claim, emit `opened` and `repaid`
  failure: state = Sealed, nothing else changes
```

### Cancel and refund

```
Host --cancel_hajat--> amplop   (fails if any token is Opened)
Anyone --refund(token_id)--> amplop
amplop: state = Refunding, ft_transfer(owner, amount), then on_refund_resolved
  success: state = Refunded
  failure: state = Sealed
```

## Key design decisions

### D1. One contract, no per-hajat or per-invitation sub-accounts

Alternatives: (a) one sub-account per hajat running a global contract, (b) one sub-account per invitation.

Why not: global contracts burn 10 NEAR per 100 KB on every publish, and by-account publishes burn again on every update. A 150 KB contract costs about 15 NEAR per publish, which is a lot of testnet faucet. Regular per-account deploys cost storage staking of about 1.5 NEAR each and need the wasm embedded in a factory. Cross-contract state also makes the ledger harder: repaying a claim in another hajat would need extra async calls and rollback paths. A single contract keeps settlement atomic and testable.

What we lose: the "invitation has its own address" idea from the NFT track hints. Escrow is a per-token balance inside the contract. Documented honestly in README. Per-hajat vault accounts stay on the parking lot.

### D2. Soulbound invitations

Alternative: transferable NFTs. A gift debt belongs to people, and a tradable claim invites selling social obligations to strangers. `nft_transfer` panics. This is allowed by NEP-171 in practice (many SBTs do it) but we do not claim NEP-393 compliance.

### D3. Two-phase money movement

Alternative: mark `Opened` first and refund on failure. Rejected because ledger state would need an undo path. We lock with `Opening` or `Refunding`, move money, and only then change the final state and the ledger. If the callback sees a failure, the only change to undo is the lock.

### D4. Ledger keyed by ordered pair

Key: `"{giver}|{receiver}"`. Value: remaining credit plus the list of open token ids. Repayment for a new gift from X to host H looks up the pair `(H, X)`, which is H's older gifts to X. Alternative was scanning all tokens of an account, which is unbounded.

### D5. Dynamic SVG computed in `nft_token`

Alternative: store an image URL and render on a server. Rejected because the pitch is that state is verifiable without our server. Cost is a few hundred bytes of string building per view call, no storage.

### D6. No database

Alternative: Postgres plus an indexer. Rejected for scope: every list we need is available as a paginated view, and the contract keeps an on-chain activity log. A cache can be added later without schema changes in the contract.

### D7. Demo personas with public testnet keys

Alternative: ask every judge to install a wallet and fund an account. Rejected because it kills the five-minute demo. The keys sit in the repo on purpose and control accounts holding only test tokens. The README says so.

### D8. Own tUSDC instead of an existing testnet token

Alternative: use whatever stable token exists on testnet. Rejected because we need a faucet and registration helper we control. The faucet registers the caller on the token so users skip `storage_deposit`.

### D9. Storage paid by callers

Every call that creates state requires an attached deposit that covers the bytes it adds. Excess is refunded. This removes a griefing path where someone floods `join` and drains the contract balance.

## Security considerations

| Threat | Mitigation |
| --- | --- |
| Fake `ft_on_transfer` from another token | Require `predecessor == ft_id` set at init |
| Someone seals into another guest's envelope | Require `sender_id == token.owner` |
| Double open or open during refund | `Opening` and `Refunding` locks, state checks first |
| Callback spoofing | `#[private]` plus `env::promise_results_count() == 1` check |
| Host never opens, funds stuck | Anyone may open after `event_at + 24h`; owner may refund after `event_at + 30d` if still sealed |
| Host unregistered on tUSDC, transfer fails | State returns to `Sealed`, UI prompts `storage_deposit` for host |
| Unbounded loops | Settlement max 10 claims per open; list views take `limit` max 50 |
| Storage griefing | Caller-funded storage, 200 invitations per hajat |
| Integer overflow | `checked_add`, `checked_sub` on all balances; release builds keep overflow checks on |
| Admin keys | `amplop` has no admin methods besides `set_app_url`. Optionally delete the full access key after the final freeze (irreversible) |
| Leaked demo keys | Testnet only, documented, never reused for other accounts |
| Relayer abuse (P2) | Method allowlist, per-account rate limit, relayer balance cap |

## Failure modes users will actually hit

| Symptom | Cause | Handling |
| --- | --- | --- |
| "Open" fails and card stays Sealed | Host not registered on tUSDC | UI runs `storage_deposit` for the host, then retries |
| `ft_transfer_call` fails with gas error | Wallet default gas too low | Client always sets 100 Tgas |
| Guest sees "Invited" after paying | RPC lag | Client polls the view for 20 s after the tx hash is final |
| RPC rate limit | Public endpoint throttling | Route handlers cache for 10 s, client falls back to the second RPC |

## Scalability plan

Out of scope for the hackathon, noted so nobody is surprised: shard state by hajat into separate accounts (the sub-account design from D1) once one contract holds more than a few thousand invitations; add an indexer and move the activity log off-chain; add an amount-hiding scheme so envelopes can be sealed without publishing the number.
