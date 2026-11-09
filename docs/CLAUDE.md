# CLAUDE.md

## Project
Promise: wedding envelopes as soulbound NFTs on NEAR testnet. The NFT escrows tUSDC until the event and the contract keeps a ledger of gifts owed back. Hackathon entry for NEAR HACKATHON, track `nfts`. Solo builder. Deadline 2026-11-14T23:59:00Z.

## Stack
- Contracts: Rust, near-sdk 5.x, near-contract-standards, cargo-near, near-workspaces for sandbox tests
- Web: Next.js 15 (App Router, TypeScript strict), Tailwind CSS v4, shadcn/ui, TanStack Query, Framer Motion
- NEAR client: near-api-js (modular v7+ API), @hot-labs/near-connect for wallets
- Backend: Next.js Route Handlers only. No database, no separate server
- Scripts: TypeScript run with tsx
- Network: NEAR testnet. RPC https://test.rpc.fastnear.com. Explorer https://testnet.nearblocks.io
- Package manager: pnpm workspaces. Node 22

## Commands
```bash
pnpm install
pnpm contracts:build      # cargo near build for contract/amplop and contract/tusdc
pnpm contracts:test       # cargo test (unit) then sandbox tests
pnpm deploy:testnet       # scripts/deploy.ts, reads .env.deploy
pnpm seed                 # scripts/seed.ts, creates the demo story
pnpm demo                 # scripts/demo.ts, runs the full story and prints explorer links
pnpm dev                  # frontend on :3000
pnpm typecheck && pnpm lint
pnpm build
```

## Project structure
```
contract/amplop/src     lib.rs, types.rs, hajat.rs, escrow.rs, ledger.rs, nft.rs, svg.rs, events.rs
contract/amplop/tests   sandbox integration tests
contract/tusdc/src      NEP-141 + faucet
frontend/src/app              routes (see docs/FRONTEND.md). API route handlers live in frontend/src/app/api, there is no backend/ folder
frontend/src/lib/near         provider, contract client, signer, format
frontend/src/components       envelope-card, ledger-table, tx-toast, persona-switcher
scripts                  deploy.ts seed.ts demo.ts
docs                     all specs. Read docs/CONTRACTS.md before touching contracts
```

## Key conventions
- Rust: one concern per module, no `unwrap()` outside tests, errors are `&'static str` constants in `errors.rs` with the prefix `ERR_`
- Amounts: u128 in contract, strings in JSON (`U128`), tUSDC has 6 decimals. Format only at the UI edge in `lib/near/format.ts`
- Time: milliseconds since epoch everywhere (`env::block_timestamp_ms()`), never nanoseconds in public APIs
- TypeScript: named exports, no default exports except Next.js pages and layouts. Zod for all external input
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`). First commit date matters for the hackathon rules, keep history honest
- Language: UI strings live in `frontend/src/i18n/{en,id}.json`. Default `en`. Docs in English except REQUIREMENTS and ROADMAP (Indonesian)
- No em dashes in any text, code comments or docs

## Architecture notes
- ONE amplop contract holds every hajat, invitation and balance. Do not create per-hajat sub-accounts or use global contracts (burn cost is 10 NEAR per 100 KB). See docs/ARCHITECTURE.md decision D1
- Invitations are soulbound NEP-171 tokens. `nft_transfer` and `nft_transfer_call` always panic with `ERR_SOULBOUND`
- Money moves in two phases. Set state to `Opening` or `Refunding`, call `ft_transfer`, finish in a `#[private]` callback. Never mark `Opened` before the FT transfer succeeds
- Ledger settlement runs only inside `on_open_resolved`, after the money has moved, oldest claim first, at most 10 claims per open
- `nft_token` builds metadata and the SVG on every call. Nothing about the card image is stored
- Every web read goes through `lib/near/contract.ts`. Components never call RPC directly
- Signing goes through the `AppSigner` interface (wallet or demo persona). Components never import near-connect directly
- Contract reads cached in route handlers with `revalidate: 10`. Client polls every 4 s only while a tx is pending

## Do NOT
- Do not add a database, ORM, or queue without asking
- Do not install a new dependency without asking. Pin exact versions
- Do not use mainnet accounts, mainnet RPC, or real funds anywhere
- Do not commit `.env*` files except `.env.example`. Demo persona keys are the only keys allowed in the repo, and only in `frontend/src/lib/demo/personas.public.json`
- Do not send the hackathon submission, make the repo public, post on X, or sign anything with a non-demo key. Those need the human to say yes
- Do not guess hackathon facts. Re-read https://nearhackathon.com/HACKATHON.md before the submission step
- Do not change contract method names or JSON shapes without updating docs/CONTRACTS.md and docs/SCHEMA.md in the same commit

## Definition of done for a task
- Code compiles, `pnpm typecheck` and `pnpm lint` pass
- Matching test from docs/CONTRACTS.md section 12 exists and passes (contracts) or the page works in demo mode (web)
- Docs updated if behavior changed

## Current focus
Contracts: phases 1 to 4 done and deployed to testnet (amplop.promisedemo.testnet, tusdc.promisedemo.testnet). Frontend: soft UI (DESIGN.md v2) with real actions: a demo persona signs in the browser (DemoSigner behind the AppSigner interface), and the event pages let a guest seal, a host invite, check in or cancel, anyone refund, and Ayu pay back what suggest_reply says. Next: QR door mode, activity feed (needs get_activity in the contract before the 13 Nov freeze), a real wallet signer. Direction is in DESIGN.md. Priorities are in docs/ROADMAP.md.
