# DESIGN.md

Visual direction for Promise. Source: the owner's tokens in `docs/FRONTEND.md` section 2. This file adds the reasons (antislop R-31) and the dials. It does not change the direction.

## Reading

Reading this as: a consumer web app and story page for Indonesian and Asian families who already understand the envelope tradition, in a warm paper-and-ink visual language, dial **ENERGY 2 / RHYTHM 3 / MOTION 2**.

## Identity

Promise is a guest book that cannot be edited. Everything should feel like paper, ink, a red envelope and a gold seal, and not like a crypto dashboard.

**Motif (one, repeated):** the envelope with a gold wax seal. It is the product object (the NFT card), so it appears as the hero, as the state strip, and as the small mark beside the wordmark. A ruled guest-book line is a supporting rule, used only where the ledger is shown.

## Palette

Core: ink and paper (neutrals), red (core). Accent: gold. Green is semantic (a repaid state), never decoration.

| Token | Value | Use | Reason |
| --- | --- | --- | --- |
| `--paper` | `#FBF7F0` | page background | The page is the guest book page |
| `--paper-deep` | `#F3EBDD` | raised panels, table bands | One step darker than paper, replaces shadows for grouping |
| `--ink` | `#3A2A1A` | body text | 12.9:1 on paper |
| `--ink-soft` | `#6B5A48` | secondary text | 6.2:1 on paper (5.6:1 on paper-deep) |
| `--red` | `#9B1C1C` | primary action, envelope | 7.6:1 on paper, 8.2:1 for white on red |
| `--red-dark` | `#7A1414` | pressed, focus ring, flap | 10.2:1 on paper |
| `--gold` | `#C9A227` | seal, coin, rules | 2.3:1 on paper, so it is never used for text |
| `--green` | `#2F6B3F` | Repaid only | 6.0:1 on paper |
| `--line` | `#E6DCCB` | borders, ruled lines | decorative, no text on it |

Single light theme. Reason: the identity is paper. A dark theme would need a second identity, so no theme toggle is shipped (R-21, R-34).

## Typography

- Headings: **Fraunces**, because its soft serif forms read as printed invitation lettering and carry the wedding tradition without script-font clichés.
- Body and UI: **Inter**, because the door check-in is used on a phone in bad light, and Inter has tabular figures for the tUSDC amounts (`font-variant-numeric: tabular-nums`) so columns of money line up. Chosen by the owner in `FRONTEND.md`; this is the reason.
- Body 16px, line height 1.55. Headings tight at 1.1 to 1.2.
- No wide-tracked uppercase labels. The only uppercase is the status stamp on the card, which mirrors a postmark and is drawn by the contract.

## Shape and depth

- Radius: 16px cards, 12px inputs and buttons, 4px for status stamps. Stamps are rectangular on purpose (postmark), so not everything is a pill.
- Shadow: only on the envelope card, because it is an object lying on the paper. Panels group with `--paper-deep` and a 1px `--line` border, not shadow.
- No glass, no glow, no gradients, no grid backgrounds.

## Layout and rhythm (RHYTHM 3)

Each section has its own composition because each carries different content:

1. Hero: asymmetric, headline left, the card right, overlapping the fold.
2. The problem: a single narrow text column beside a wide empty margin, set like a book page.
3. States: four cards staggered vertically (they are a sequence, not a feature grid).
4. Ledger: a ruled table, the only place the guest-book lines appear.
5. Limits: plain list, no cards, no icons.

## Motion (MOTION 2)

- The hero card plays its four states once on load and rests on Repaid. A "Replay" text button repeats it. No loops.
- States cards and ledger rows reveal once on scroll (8px, 250ms).
- Everything respects `prefers-reduced-motion`: the hero shows the final state, no reveals.

## Voice

Plain, specific, no marketing words. Amounts always with the unit (`5.00 tUSDC`). No em dashes. Indonesian copy is written for the same reader, not translated word for word.

## What we do not have yet (honest placeholders)

- Logo: the wordmark "Promise" set in Fraunces, plus the envelope mark drawn from the card. Placeholder until the owner supplies a logo.
- No testimonials, statistics, partner logos or FAQ, because none are real.
