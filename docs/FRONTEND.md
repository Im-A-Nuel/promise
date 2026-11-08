# Frontend Specification

Last updated: 2026-11-09. Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Query, Framer Motion.

## 1. Principles

- Mobile first. Design at 360 px wide, scale up. Hosts will use this at the door on a phone.
- The contract is the source of truth. The card image shown in the UI is the `media` field returned by `nft_token`, not a client-side drawing.
- Two ways to sign, one interface: a real wallet or a demo persona. Pages never know which.
- Every transaction shows its NearBlocks link. Judges verify with it.
- No state is kept outside the chain except UI preferences (locale, selected persona) in `localStorage`.

## 2. Design tokens

Warm paper, red envelope, gold trim. Different from generic crypto dashboards on purpose.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FBF7F0` | page background |
| `--ink` | `#3A2A1A` | body text |
| `--ink-soft` | `#6B5A48` | secondary text, 4.5:1 on paper |
| `--red` | `#9B1C1C` | primary buttons, envelope |
| `--red-dark` | `#7A1414` | pressed, focus ring |
| `--gold` | `#C9A227` | accents, coin, progress |
| `--green` | `#2F6B3F` | Repaid, success |
| `--line` | `#E6DCCB` | borders |

Fonts via `next/font`: Fraunces for headings, Inter for body. Radius 16 px on cards, 12 px on inputs. Body 16 px, minimum tap target 44 px.

## 3. Information architecture

Bottom tab bar on mobile, top nav on desktop. Four tabs inside `/app`.

| Tab | Route | Content |
| --- | --- | --- |
| Hajat | `/app` | Hajats I host, plus "Create hajat" |
| Invitations | `/app/invitations` | Invitation cards I hold |
| Ledger (Neraca) | `/app/neraca` | Who owes me, who I owe |
| Profile | `/app/profile` | Account, tUSDC balance, faucet, language, sign out |

## 4. Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | public | Story in 15 seconds, two buttons: "Try demo", "Connect wallet" |
| `/demo` | public | Persona switcher, disclaimer, link to the 7-step walkthrough |
| `/app` | signed in | Hosted hajats |
| `/app/hajat/new` | signed in | Create hajat form |
| `/app/hajat/[id]` | host | Guest list, invite form, share link and QR, door mode link, cancel |
| `/app/invitations` | signed in | My invitation cards |
| `/app/neraca` | signed in | Ledger |
| `/app/profile` | signed in | Faucet and settings |
| `/h/[id]` | public | Public hajat page. RSVP button if `OpenLink`. OG image |
| `/invitation/[tokenId]` | owner or public read | Card, seal form, pay-back suggestion, refund, history |
| `/scan/[hajatId]` | host | Door mode: QR scanner and manual token entry |
| `/api/*` | server | See SCHEMA.md |

Unauthenticated users hitting `/app/*` are redirected to `/` with a toast.

## 5. Page behavior

### `/` landing
Hero line "Every gift is a promise to give back." Three short blocks: what the envelope means, what the card shows, what the ledger remembers. One looping 6 second animation of the card going Invited, Sealed, Opened, Repaid using real SVGs fetched from testnet tokens in the seed (fallback to static assets). Buttons: Try demo, Connect wallet.

### `/demo`
Five persona cards (Ayu, Budi, Citra, Dewi, Eko) with role, one-line story and the account id. Selecting one signs in with `DemoSigner`. A banner on every page in demo mode: "Demo account. Testnet only. Keys are public." A "Reset" link points to the seed docs.

### `/app` (Hajat)
List of `get_hajats_by_host`. Each row: title, date, `invite_count`, sealed and released totals. Empty state explains the idea in one sentence and offers "Create hajat".

### `/app/hajat/new`
Fields: title, kind, venue, date and time (local timezone, converted to ms), join policy. Submits `create_hajat` with deposit 0.02 NEAR. After the tx is final, navigate to `/app/hajat/[id]`.

### `/app/hajat/[id]` (host)
- Header: title, date, status chip, totals.
- Guests tab: `get_invitations` table with label, account, `card_status`, amount (only when Opened). Row actions: "Check in" (when Sealed or Invited and inside the time window), "Open" (host, Sealed). Multi-select is not needed.
- Invite tab: single invite form and a paste-many box (one `account,label` per line, up to 20). Uses `invite_many`.
- Share tab: link to `/h/[id]`, QR code (qrcode.react), switch for `open_link`.
- Door mode button opens `/scan/[id]`.
- Cancel button with confirm dialog. Disabled with an explanation when any invitation is Opened.
- Before the first open the page checks that the host is registered on tUSDC (`storage_balance_of`). If not, a one-click "Register to receive tUSDC" button runs `storage_deposit` or `faucet`.

### `/invitation/[tokenId]`
- Top: the on-chain card (`<img src={media}>`), refreshed every 4 s while a tx is pending, otherwise every 30 s.
- Below: status sentence in plain words ("Waiting for the event on 14 Nov. Your envelope is locked.").
- Seal form (when Invited or Sealed, hajat Open, before the deadline): amount presets 1, 5, 10 and a custom field, note up to 140 characters. Button "Seal envelope" calls `ft_transfer_call` with 100 Tgas, 1 yoctoNEAR.
- "Pay back what I owe" block: shown when `suggest_reply(hajat_id, me) > 0`. Prefills the amount and explains in one line: "Ayu gave 5.00 at Budi's wedding. This settles that."
- Refund button when the contract rule allows it (hajat Cancelled, or 30 days after the event).
- History: `get_activity` entries filtered by token, newest first, each with a NearBlocks link when known.

### `/app/neraca`
Two sections from `get_ledger`: "You owe" and "Owed to you". Row: counterparty, remaining amount, count of open envelopes, expandable list of cards. Totals at the top. Empty state: "Nothing owed. Suspiciously clean."

### `/scan/[hajatId]` (door mode)
Camera view with a QR scanner. QR payload is the string `promise://t/{tokenId}`. On scan: fetch the invitation, show the guest label and status, then call `check_in`. Fallback input for a manual token id. Success shows a green full-width banner and a haptic tick if available. P2: use a function-call key limited to `check_in` and `open` so no wallet prompt appears per guest.

### `/h/[id]` public hajat page
Title, date, venue, kind, host account, guest count. If `OpenLink`: "RSVP" asks for a display name then calls `join`. If the viewer already has an invitation, button reads "Open my invitation".

### `/app/profile`
Account id, NEAR balance, tUSDC balance, "Get 100 tUSDC" (calls `faucet`, shows cooldown from `faucet_next_at`), language switch, sign out.

## 6. Folder structure

```
web/src/
  app/                       routes above
  components/
    envelope-card.tsx        <img> of on-chain media with skeleton and alt text
    status-chip.tsx
    seal-form.tsx
    pay-back-card.tsx
    ledger-table.tsx
    tx-toast.tsx
    persona-switcher.tsx
    qr-share.tsx
    qr-scanner.tsx
    ui/                      shadcn components
  lib/
    near/
      provider.ts            JsonRpcProvider with fallback
      contract.ts            typed view and call wrappers
      ft.ts                  tUSDC helpers (balance, register, sealCall)
      signer.ts              AppSigner interface and context
      wallet-signer.ts       near-connect implementation
      demo-signer.ts         KeyPair implementation
      format.ts              amounts, dates, account ids
      types.ts               from SCHEMA.md
    demo/personas.public.json
    i18n/index.ts            t(), useLocale()
  i18n/en.json id.json
  hooks/
    use-tx.ts                state machine for a transaction
    use-invitation.ts  use-hajat.ts  use-ledger.ts
```

## 7. Signer abstraction

```ts
export interface TxResult { txHash: string; explorerUrl: string }

export interface CallArgs {
  contractId: string;
  method: string;
  args: Record<string, unknown>;
  gas?: bigint;        // default 100 Tgas
  deposit?: bigint;    // yoctoNEAR, default 0
}

export interface AppSigner {
  kind: "wallet" | "demo";
  accountId: string | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  call(args: CallArgs): Promise<TxResult>;
  callBatch?(calls: CallArgs[]): Promise<TxResult>;   // P2: multiple actions in one tx
}
```

- `WalletSigner` wraps `NearConnector` from `@hot-labs/near-connect` (`connect`, `wallet()`, `signAndSendTransaction`) and builds actions with the near-api-js action creators.
- `DemoSigner` builds an `Account` from the selected persona's `KeyPair` and calls `signAndSendTransaction`. It never prompts.
- A React context exposes the active signer. A persona switch replaces it without a reload.

## 8. Transaction flow

`useTx` is a small state machine: `idle -> signing -> pending -> confirming -> done | error`.

1. `signing`: wallet prompt or demo signer working.
2. `pending`: tx broadcast, we hold the hash.
3. `confirming`: poll the relevant view every 2 s up to 20 s until the expected change appears (for example `card_status` becomes `Sealed`). RPC lag is real.
4. `done`: toast with the NearBlocks link `https://testnet.nearblocks.io/txns/{hash}`; invalidate affected queries.
5. `error`: map contract panics to friendly text. The map lives in `lib/near/errors.ts` and covers every `ERR_*` code in CONTRACTS.md section 10.

Defaults: gas 100 Tgas for anything touching tUSDC, 30 Tgas for plain contract writes, 150 Tgas for `check_in` and `open`.

## 9. Data fetching

- Reads go through `lib/near/contract.ts`, which calls `provider.callFunction` on the primary RPC and retries once on the fallback.
- Server components and route handlers use `fetch` with `next: { revalidate: 10 }` for shared reads.
- Client queries use TanStack Query with `staleTime` 5 s. Pages with a pending tx refetch every 4 s.
- Pagination: views take `from` and `limit` (max 50). Lists load 20 at a time with a "Show more" button.

## 10. Internationalization

Two dictionaries, `en` (default) and `id`. `t("seal.button")` style keys, no inline strings in components. Dates use `Intl.DateTimeFormat` with the active locale. Amounts show two decimals and the symbol: `5.00 tUSDC`. Missing keys fall back to English and log a dev warning.

## 11. Animation and accessibility

- Opening animation: card scales 1.0 to 1.04, flap rotates, coin drops, 600 ms. Only plays when the status changes while the user is watching. Disabled under `prefers-reduced-motion`.
- Contrast 4.5:1 minimum, visible focus ring in `--red-dark`.
- Every `<img>` card has alt text built from the status and amount, for example "Envelope from Budi, opened, 5.00 tUSDC".
- Buttons never rely on color alone; status chips carry an icon and a word.
- Scanner has a keyboard path via manual input.

## 12. Error and empty states

| Situation | UI |
| --- | --- |
| Wallet not installed or user closes the prompt | Inline message with "Use a demo account instead" |
| tUSDC balance too low to seal | Disable submit, show "Get 100 tUSDC" button |
| Host not registered on tUSDC | Warning on the host page with one-click register |
| RPC down | Banner "Testnet is slow right now", retry button, last good data stays visible |
| Hajat not found | 404 page with link home |
| Contract panic | Toast with mapped message and the raw `ERR_*` code in small text |

## 13. Tests

| Layer | Tool | What |
| --- | --- | --- |
| Unit | Vitest | `format.ts`, error mapping, i18n fallback, `useTx` reducer |
| Component | Vitest + Testing Library | `seal-form` validation, `envelope-card` alt text |
| E2E | Playwright against testnet in demo mode | E2E-01 to E2E-07 mirror the README walkthrough steps 1 to 7 |
| Manual | Real wallet on a phone | Connect, seal, check in via QR. Done once before submission |

E2E runs only on demand (`pnpm e2e`) because it spends testnet gas and takes about 90 seconds.
