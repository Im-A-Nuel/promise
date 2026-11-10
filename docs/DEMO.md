# Demo, Video and Submission Kit

Last updated: 2026-11-09. Read https://nearhackathon.com/HACKATHON.md again before submitting. Dates and rules can change.

## 1. Seed story

`pnpm seed` creates this on testnet. Event times are set to about 12 hours ahead of the seed run, so the host window (opens 24 hours before the event) is already open and nothing is "in the past".

| Persona | Account | Role in the story |
| --- | --- | --- |
| Ayu | `ayu.promisedemo.testnet` | Hosts the wedding (hajat 1) |
| Budi | `budi.promisedemo.testnet` | Gives at Ayu's wedding, later hosts a khitan (hajat 2) |
| Citra | `citra.promisedemo.testnet` | Gives at Ayu's wedding, never gives back (shows an open debt) |
| Dewi | `dewi.promisedemo.testnet` | Invited to Ayu's wedding, has not sealed yet. Used live in the demo |
| Eko | `eko.promisedemo.testnet` | Hosts a house blessing (hajat 3), cancels it, guests get refunds |

| Hajat | Host | Title | Policy | Seeded state |
| --- | --- | --- | --- | --- |
| 1 | Ayu | Ayu & Bima's Wedding | OpenLink | Budi sealed 5 and opened, Citra sealed 2 and opened, Dewi Invited |
| 2 | Budi | Raka's Celebration | InviteOnly | Ayu Invited, Citra Invited. Nothing sealed |
| 3 | Eko | Eko's Housewarming | InviteOnly | Dewi sealed 3, hajat Cancelled, refund not yet claimed |

After seeding, the ledger reads: Ayu owes Budi 5.00 and Citra 2.00. Dewi's 3.00 sits in hajat 3 waiting for a refund call.

Token ids are assigned in order. `seed.ts` prints the mapping, paste it here after the first run:

```
token 1 = Budi @ hajat 1
token 2 = Citra @ hajat 1
token 3 = Dewi @ hajat 1
token 4 = Ayu @ hajat 2
token 5 = Citra @ hajat 2
token 6 = Dewi @ hajat 3
```

## 2. The live walkthrough (matches README "Try it")

| Step | Persona | Do | Expected |
| --- | --- | --- | --- |
| 1 | Ayu | Open hajat 1 | Three invitations: Budi Opened 5.00, Citra Opened 2.00, Dewi Invited |
| 2 | Dewi | Open invitation, seal 5 with a note | Card goes Invited to Sealed, amount hidden, tx link shown |
| 3 | Ayu | Check in Dewi | Card Opened 5.00, Ayu tUSDC +5 |
| 4 | Ayu | Open Neraca | Owes Dewi 5.00, Budi 5.00, Citra 2.00 |
| 5 | Budi | Open hajat 2, check Ayu's invitation exists | Ayu is a guest at Budi's event |
| 6 | Ayu | Open invitation to hajat 2, press "Pay back what I owe" | Amount prefilled 5.00 from `suggest_reply`, note optional, seal |
| 7 | Budi | Check in Ayu | Ayu's card shows Reply. Budi's original card from hajat 1 shows Repaid. Ayu's Neraca no longer lists Budi |

Bonus branch if time allows: Ayu seals 8 in step 6. Expected: Budi's old card Repaid, Ayu's new card Opened 8.00 with credit 3.00, Budi's Neraca now shows he owes Ayu 3.00.

Dewi refund branch: any persona calls `refund` on Dewi's token in hajat 3. Dewi receives 3.00 even though the caller was someone else.

## 3. `pnpm demo` output contract

The script runs the walkthrough on fresh invitations (new hajat, so it does not depend on the seed) and prints one line per step:

```
[01] Ayu creates hajat "Demo wedding" ........ https://testnet.nearblocks.io/txns/<hash>
[02] Ayu invites Budi, Citra ................. https://...
...
[12] Budi's card status: Repaid .............. (view call)
OK: 12 steps, 0 failures, 142 s
```

Exit code is 0 only when every expected state matches. Minimum 12 explorer links (acceptance criterion in REQUIREMENTS.md).

## 4. Video storyboard (target 2:30, hard limit 3:00)

| Time | Screen | Say |
| --- | --- | --- |
| 0:00 | Photo of a paper guest book, then cut to a blank phone | "At weddings in Indonesia the envelope is a debt of honor. The record is a paper book people lose." |
| 0:15 | Landing page, press Try demo | "Promise puts that envelope on NEAR as an NFT. This is testnet and these are demo accounts." |
| 0:25 | Ayu's hajat page | "Ayu hosts a wedding. Each guest holds a soulbound invitation." |
| 0:40 | Dewi seals 5 | "Dewi locks five test dollars in her invitation. The card is drawn by the contract, so the amount stays hidden until the event." |
| 1:00 | Ayu checks Dewi in, card flips | "Check-in opens the envelope. The money moves, the card changes." |
| 1:20 | Neraca | "The contract now remembers that Ayu owes Dewi, Budi and Citra." |
| 1:40 | Budi's khitan, Ayu pays back | "Months later Ayu goes to Budi's event. The app already knows what she owes." |
| 2:00 | Budi's old card shows Repaid, Ayu's Neraca shrinks | "The old envelope is settled, oldest first, by the contract. Nobody edited a book." |
| 2:15 | NearBlocks tab, `nft_token` view | "Everything is on chain. No server draws this card." |
| 2:25 | Limits slide | "Repayment is social, not enforced. Amounts are public. Testnet only." |
| 2:30 | End | Repo URL on screen |

Record at 1080p with the phone frame in a desktop browser or a real phone screen capture. Add captions. Say "demo accounts" out loud once.

## 5. Judge notes (AI and human)

- Fastest check: `pnpm demo`. No wallet, no setup beyond `pnpm install` and a root key for the demo personas (their keys are in the repo).
- No-install check: open `/demo`.
- Contract check: `near contract call-function as-read-only amplop.promisedemo.testnet nft_token json-args '{"token_id":"1"}' network-config testnet now`, decode `media`.
- Where to look for depth: `contract/amplop/src/ledger.rs` (settlement and invariants), `svg.rs` (card), `escrow.rs` (two-phase transfer and rollback), `tests/` (T-01 to T-40).

## 6. Post on X (the human writes and publishes it)

The post must say the project was built at NEAR HACKATHON and carry the demo video or screenshots. Two drafts. Edit freely, post from your own account, then give the link to the agent.

Draft A:

```
Built Promise at NEAR HACKATHON.

At weddings in Indonesia the envelope is a debt of honor, and the record is a paper guest book that gets lost.

Promise makes each guest invitation a soulbound NFT that holds the money until the event, then keeps a ledger of who owes whom. The card is drawn by the contract itself.

Testnet, demo accounts, repo + video below.
```

Draft B:

```
My aunt keeps a notebook of every envelope she gave and received since 1998. If it burns, so does the debt.

Spent the hackathon putting that notebook on NEAR. Built at NEAR HACKATHON: soulbound invitation NFTs, escrow until the event, and a ledger that repays the oldest envelope first.

Demo video attached. Testnet only.
```

Draft B has an anecdote. Only use it if it is true for you; change it to something that is.

## 7. Submission checklist

The rules say to collect every value from the human. Nothing below is prefilled on purpose.

| Field | Rule | Who provides | Status |
| --- | --- | --- | --- |
| projectName | 2 to 80 chars, unique across the hackathon, case-insensitive | You. Plan: `Promise`. A 409 means the name or email is taken. HACKATHON.md says the agent must not rename to get around it, so stop and let the human decide (fallback idea: `Promise Amplop`) | TODO(user) |
| leadName | 2 to 80 chars | You | TODO(user) |
| email | valid, max 160, unique | You | TODO(user) |
| size | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` | `1` (solo) | confirm |
| tracks | ids from the track table | `["nfts"]` suggested | confirm |
| nearAddress | mainnet, lowercase, matches the regex in HACKATHON.md | You create it in a wallet. Never reuse a demo account | TODO(user) |
| projectUrl | public repo, max 300 chars | You, after making it public | TODO(user) |
| demoUrl | public X post, max 300 chars | You, after posting | TODO(user) |
| idea | 20 to 2000 chars | Draft in section 8, you edit and approve | TODO(user) |
| consent | must be `true` only after you agree to the notice | You | TODO(user) |
| requestId | UUID, generated once, reused on retries | Agent generates, you keep it | generate once |

Consent notice, to be read to you verbatim by the agent: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

Order of operations:

1. Contracts frozen, seed done, `pnpm demo` passes.
2. README has no `TODO(deploy)`.
3. Repo made public (you do it).
4. Video recorded, X post published (you do it).
5. Agent prints the full JSON payload. You read it and say yes.
6. One POST to `https://nearhackathon.com/api/applications`. A second attempt with the same project name or email is rejected, so there is one try.
7. Expect 201. Keep the response. On 400 fix the listed fields and resend with the same `requestId`. On 409 stop and ask. On 403 stop, the window is closed.

Submit by 2026-11-14T12:00:00Z (19:00 WIB Saturday). The hard deadline is 2026-11-14T23:59:00Z, which is 06:59 WIB on Sunday 15 November.

Payload shape (values are placeholders, do not send as is):

```json
{
  "requestId": "GENERATE-ONCE",
  "projectName": "Promise",
  "leadName": "TODO(user)",
  "email": "TODO(user)",
  "size": "1",
  "tracks": ["nfts"],
  "nearAddress": "TODO(user)",
  "projectUrl": "TODO(user)",
  "demoUrl": "TODO(user)",
  "idea": "see section 8",
  "consent": true
}
```

Do not add other fields. The `website` field is a spam trap.

## 8. Draft for the `idea` field (about 1100 characters)

```
In Indonesia and much of Asia, a wedding envelope is a debt of honor: you give what you expect to receive back. The record is a paper guest book that gets lost or disputed. Promise puts it on NEAR.

A host creates an event and invites guests. Each guest holds a soulbound NEP-171 invitation. The guest seals test USDC into the invitation with a single ft_transfer_call. On the day the host checks the guest in, the contract moves the money and the card changes. The contract then records the gift as a claim. When the host later attends the guest's own event and gives an envelope, the contract repays the oldest claim first, so the original card flips to Repaid and any surplus becomes a new claim in the other direction.

The card image is an SVG built inside nft_token on every read, so state is verifiable without our server. Money moves in two phases with rollback. Testnet only, own faucet token, demo personas disclosed in the README. Repayment is a social record, not enforced.

NEAR parts: NEP-171 and NEP-177, NEP-141 ft_transfer_call, NEP-297 events, fast finality for the door check-in.
```

Count the characters before sending. HACKATHON.md allows 20 to 2000.

## 9. Disclosures to keep in the README and video

- Testnet only. No real funds.
- Persona accounts are controlled by the author and exist to show every state.
- Invitations are not sub-accounts, escrow is a balance inside one contract.
- Repayment is not enforced. Amounts are public.
- Built solo during the hackathon window. Commit history shows it.
