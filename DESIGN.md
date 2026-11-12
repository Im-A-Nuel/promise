# DESIGN.md

Visual direction for Promise. Version 2, replacing the flat paper direction. The owner asked for a soft, cute, app-like feel in the style of a calm onboarding screen: pastel glow, a friendly character, big rounded shapes, dots for a carousel and a floating tab bar. The brand colors stay the same (red envelope, gold seal, cream paper).

## Reading

Reading this as: a consumer app and story site for anyone who knows the wedding red envelope tradition (angpao, hongbao, amplop), international, English first with an Indonesian option, in a soft and playful 3D-pastel style, dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

## Identity

Promise feels like a warm gift, not a finance tool. The one motif is **Pao**, a small red envelope character with a gold seal that doubles as its button nose. Pao changes mood with the state of the card:

| State | Pao |
| --- | --- |
| Invited | flap open, looking up, waiting |
| Sealed | flap shut with the gold seal, eyes closed in a content smile |
| Opened | flap open, a gold coin pops out, big smile |
| Repaid | green check badge, happy eyes, sparkles |

Pao appears in the hero, in empty states and on the account screens. On the event pages each guest card shows the Pao pose of its state, with the amount and a check drawn by the app. The contract draws its own plain SVG of the card on chain, which wallets, explorers and `/api/nft/:id/image.svg` show. The app must not say that the picture on the page is that SVG.

The app icon is the glossy red squircle envelope with a gold seal (`design/`). It is the favicon and the header mark.

## Palette

| Token | Value | Use | Reason |
| --- | --- | --- | --- |
| `--cream` | `#FFF8F1` | page | Warm paper, the base of the glow |
| `--blush` | `#FFE9E3` | soft panels, active tab | Gentle second layer |
| `--peach` | `#FFD8C7` | glow, illustration | Warmth behind Pao |
| `--ink` | `#3A2A1A` | text | High contrast on cream |
| `--ink-soft` | `#6B5A48` | secondary text | Readable small text |
| `--red` | `#9B1C1C` | actions, Pao | The envelope |
| `--red-bright` | `#D8453B` | Pao highlights | Soft 3D light side |
| `--red-dark` | `#7A1414` | pressed, focus | Shadow side |
| `--gold` | `#C9A227` | seal, coin | Decoration only, never text |
| `--gold-soft` | `#F6DC84` | sparkles | Light accent |
| `--mint` | `#DFF3E4` | repaid chip | Calm success |
| `--green` | `#2F6B3F` | repaid text and badge | Success |
| `--line` | `#F0DDD0` | borders | Warm hairline |

One light theme. A theme toggle is not shipped, because the cream glow is the identity.

## Type

- Headings: **Fredoka**, a rounded friendly sans that matches the soft shapes.
- Body and UI: **Nunito**, rounded terminals, readable on a phone, tabular figures available for amounts.
- Notes: **Caveat**, only for the short handwritten notes next to Pao (one line, one place per screen).
- Body 16 px, line height 1.55.

## Shape and depth

- Cards and panels 28 px radius, inputs and buttons 18 px, chips and the tab bar fully round. Round everything softly, but keep hierarchy: the primary button is the only chunky red element on a screen.
- Depth comes from soft colored shadows and inner highlights, not from borders. Backdrop blur is used on exactly two things: the floating tab bar and the status pill.
- The page glow is three soft radial gradients (peach, blush, cream gold) behind everything. It is the one place gradients cover a whole surface, and it is the brand mood, so it stays calm and low contrast.

## Layout

- Mobile first, 390 px. Order on the home screen: status pill, headline, line of copy, the card carousel scene with dots, the primary button, then the story sections.
- A floating tab bar at the bottom on phones: Home, Ledger, Events, Accounts. On desktop the same four links sit in the header.
- Desktop (from 768 px): the headline and button on the left, the carousel scene on the right in a larger rounded stage. Story sections alternate between a text column and a card column.
- Each section has its own composition (RHYTHM 2): the problem is a single warm note card, the states are a carousel on mobile and a row on desktop, the ledger is a soft table card, the limits are plain text.

## Motion

- Pao floats gently and blinks every few seconds. Nothing else loops.
- The carousel scrolls with snap. Cards rise 8 px once on scroll into view.
- `prefers-reduced-motion`: no float, no blink, no smooth scrolling, no rise.

## Voice

Friendly, plain, specific. Amounts always with the unit (`5.00 tUSDC`). No em dashes. No emoji in the interface; Pao and the sparkles carry the charm. English first. "Event" in every user-facing text, even though the contract calls it a hajat.

## Honest placeholders

- Pao is the character, not a logo. The icon is the logo mark.
- No testimonials, statistics, partner logos or FAQ.
- The four cards on the home page are drawings of the states. The event pages show the same poses for real invitations, driven by the status the contract reports.
