# Promise

Every gift is a promise to give back.

Promise puts the wedding envelope (amplop, angpao, hongbao, buwuh) on NEAR as an NFT. The NFT holds the money until the event, then the contract keeps a record of who owes whom a gift in return.

Built solo at NEAR HACKATHON 2026. Track: NFTs That Do Something. Network: NEAR testnet only.

## The problem

In Indonesia and much of Asia, an envelope at a wedding is a debt of honor, not a present. If someone gave 100 at your wedding, you are expected to give 100 or more at theirs. Everyone knows this. The record lives in a paper guest book that gets lost, swapped, or argued over by relatives twenty years later.

Digital angpao apps exist and they send money. They do not remember what you owe.

## What it does

1. A host creates a hajat (an event) and invites guests by account, or shares an open RSVP link.
2. Every guest holds a soulbound NFT invitation. The guest seals an envelope: tUSDC is locked inside that invitation until the event. If the host cancels, the guest takes the money back.
3. On the day the host checks the guest in. The envelope opens, the money moves to the host, and the NFT card changes to show the amount.
4. A guest can show a QR door pass. The host opens it on their phone and checks that guest in.
5. The contract stores the gift as a claim. When the host later attends the guest's own event and gives an envelope, the contract repays the oldest claim first and the original card flips to "repaid". Anything above the debt becomes a new claim in the other direction.

The card image is an SVG generated inside the contract's view function. A wallet or explorer shows the current state without trusting our server. The web app shows the same states with its own Pao artwork, so what you see on a page is not that SVG. The contract also keeps its own activity log, so the event page can show a history with no indexer.

## Try it in five minutes

Open https://promise-near.vercel.app/demo, or run `pnpm dev` and open http://localhost:3000/demo. No wallet needed. Demo mode signs with pre-funded testnet personas.

| Step | Do | See |
| --- | --- | --- |
| 1 | Pick **Ayu** (host). Open the hajat "Ayu & Bima's Wedding". | Three invitations: Budi, Citra, Dewi. Dewi has not sealed yet. |
| 2 | Switch to **Dewi**. Open her invitation. Seal 5 tUSDC with a short note. | The card changes from "Invited" to "Sealed". The amount stays hidden. The tx link opens on NearBlocks. |
| 3 | Switch back to **Ayu**. Press "Check in" on Dewi's invitation. | Card turns "Opened" and shows 5.00. Ayu's tUSDC balance goes up by 5. |
| 4 | Open **Ledger** as Ayu. | "You owe Dewi 5.00", "You owe Budi 5.00", "You owe Citra 2.00". |
| 5 | Switch to **Budi**. Open his hajat "Raka's Celebration". | Budi is the host now. Ayu and Citra are invited as guests. |
| 6 | Switch to **Ayu**. Open Budi's invitation. Press "Pay back what I owe" and confirm. | Suggested amount is 5.00, taken from the ledger. |
| 7 | As Budi, check Ayu in. Open Ledger for Ayu. | Ayu's debt to Budi is 0. Budi's original card in Ayu's hajat now reads "Repaid". |

Prefer the terminal? `pnpm demo` runs the same kind of story on fresh events against testnet and prints a NearBlocks link after every step. The walkthrough above is the state `pnpm seed` prepares on an empty contract.

At the door: as a guest, press "Show door pass" on your invitation. As the host, open that QR with the phone camera. The page opens with a "Check in" button for that guest.

## Verify on-chain

| Item | Value |
| --- | --- |
| Main contract | `amplop.promisedemo.testnet` |
| Token (tUSDC) | `tusdc.promisedemo.testnet` |
| Explorer | `https://testnet.nearblocks.io/address/amplop.promisedemo.testnet` |
| Every transaction | The contract page on NearBlocks, linked above. `pnpm demo` also prints one link per step |

Read the state yourself, no UI needed:

```bash
near contract call-function as-read-only amplop.promisedemo.testnet get_ledger json-args '{"account_id":"ayu.promisedemo.testnet"}' network-config testnet now
near contract call-function as-read-only amplop.promisedemo.testnet nft_token json-args '{"token_id":"1"}' network-config testnet now
```

`nft_token` returns metadata whose `media` field is the card as a data URI. Paste it into a browser to see it.

## NEAR features used

| Feature | Where |
| --- | --- |
| NEP-171 NFT with the transfer methods disabled (soulbound) | Invitations cannot be sold or moved |
| NEP-177 metadata, computed on every read | Dynamic card (state, amount, repayment progress) |
| NEP-141 `ft_transfer_call` | Sealing an envelope in one transaction |
| NEP-297 events and an on-chain activity log (`get_recent_activity`) | Indexers, and the history on each event page with no indexer |
| Function call access keys | Door scanner key limited to `check_in` (planned, P1) |
| NEP-366 meta transactions | Gasless guests (planned, P2) |

## Limits, stated plainly

- Repayment cannot be forced. It is a social record, not a legal contract. The value is a record nobody can edit.
- Amounts are public on chain. A privacy layer is on the roadmap, not built.
- Money is testnet tUSDC from our own faucet. Nothing here touches real funds.
- Invitations are not sub-accounts. One contract holds all balances. See `docs/ARCHITECTURE.md` for why.
- Crypto is not legal tender in Indonesia, so the product is framed as an Asian gift tradition, not a payment method.

## Demo accounts

Every persona in demo mode (Ayu, Budi, Citra, Dewi, Eko) is a testnet account controlled by the author. Their keys are published on purpose and hold only test tokens. They exist to show every state of the card. They are not real users.

## Repo layout

```
contract/amplop     main contract (Rust, near-sdk)
contract/tusdc      test stablecoin with a faucet
frontend            Next.js app and API routes
scripts             deploy, seed, demo (TypeScript)
docs                requirements, architecture, contract spec, runbooks
```

## Run locally

Needs Rust 1.95 (pinned in `rust-toolchain.toml`) with `wasm32-unknown-unknown`, `cargo-near` 0.23, Node 22, pnpm 9. The deploy script reads the root key from `~/.near-credentials/testnet`.

```bash
pnpm install
pnpm contracts:test      # unit + sandbox tests
pnpm contracts:build     # wasm into contract/target/near
cp frontend/.env.example frontend/.env.local
pnpm dev                 # http://localhost:3000
```

Deploy to your own testnet accounts with `pnpm deploy:testnet` (dry run) and `pnpm deploy:testnet --execute`. Runbook: `docs/DEPLOYMENT.md`.

## Docs

| File | Read it for |
| --- | --- |
| `docs/REQUIREMENTS.md` | Scope, requirements, non-goals (Indonesian) |
| `docs/ARCHITECTURE.md` | System design and decisions |
| `docs/CONTRACTS.md` | Contract state machine, methods, gas, security |
| `docs/SCHEMA.md` | Types and HTTP API |
| `docs/FRONTEND.md` | Pages, components, signer design |
| `docs/DEPLOYMENT.md` | Testnet runbook |
| `docs/DEMO.md` | Seed data, demo script, submission checklist |
| `docs/ROADMAP.md` | Day plan to the deadline (Indonesian) |

## Built during the hackathon

All code in this repository was written inside the hackathon window. The first commit is dated 2026-11-09 and there is no earlier baseline, so there is no pre-hackathon tag. Read the full history with `git log --reverse`.

## Libraries and tools

| Area | What | Notes |
| --- | --- | --- |
| Contracts | near-sdk 5.30.1, near-contract-standards 5.30.1, near-workspaces 0.24.0, cargo-near 0.23 | Rust 1.95. No contract template was copied, the escrow, ledger, card and activity log are original |
| Web | Next.js 15, React 19, Tailwind CSS v4, TanStack Query, framer-motion, zod, near-api-js, qrcode | Next.js route handlers are the only backend, there is no database |
| Fonts | Fredoka, Nunito, Caveat (Google Fonts, OFL) | Loaded through next/font |
| Scripts | tsx, vitest, near-api-js | Deploy, seed and demo |
| Art | The mascot Pao, the event icons and the app mark are 3D artwork made with an AI image generator and prepared by the author (`frontend/public/art`, `frontend/public/brand`). The gift icon, the clouds, the interface icons, the pixel sprites and the avatars are drawn in code | |

## License

MIT. Built by Imanuel (GitHub: [Im-A-Nuel](https://github.com/Im-A-Nuel)).
