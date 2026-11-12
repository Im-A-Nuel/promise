# Final checklist, 12 to 14 November 2026

Owner: **H** = the human, **A** = the agent. Hard deadline 2026-11-14T23:59:00Z (06:59 WIB on 15 Nov). Aim to submit by 2026-11-14T12:00:00Z (19:00 WIB). The submission values are in docs/DEMO.md section 7.

## 1. Now (12 Nov): get the UI live
- [ ] **H** Merge PR #9 (mobile first screen, NFT reference route), then PR #10 (Pao card art). The agent cannot: auto mode blocks `gh pr merge`. `gh pr merge 9 --merge` then `gh pr merge 10 --merge`, or the GitHub button.
- [ ] **A** After Vercel redeploys main, check on https://promise-near.vercel.app:
  - `/api/nft/1` returns 200 with title, media and attributes.
  - `/events/1` shows the Pao cards, no on-chain SVG.
  - A phone width first screen shows the demo button.
- [ ] **H** Say if any UI detail still bothers you. Anything changed after the video is recorded costs a re-record, so finish UI now.

## 2. Chain and video (13 Nov, before the 14:00 UTC contract freeze)
A reset costs a seed, and a recording spends the seed. So the order is fixed: reset, seed, record, then reset and seed one last time.
- [ ] **H** Plug in the SSD that holds WSL (builds and deploys fail without it).
- [ ] **A** (ask first) `refund` on Dewi's token in hajat 3, so no more tUSDC is stranded in the amplop account.
- [ ] **A** (ask first) `pnpm deploy:testnet --reset --execute --app-url https://promise-near.vercel.app`, then `pnpm seed`. Known and harmless: the check "the contract holds only Dewi's 3.00" fails, because 3.00 test tUSDC from an earlier reset is stranded.
- [ ] **A** Re-record every scene that shows a card, render, and replace `F:\Hack\video\out\promise-demo.mp4` and `.srt`. Workflow is in `F:\Hack\video\CLAUDE.md`, section "Komposisi kelima: PromiseDemo".
- [ ] **H** Watch the whole video once (the agent only checked it by contact sheets). Check the volume of the voice over against the music.
- [ ] **A** (ask first) Final `--reset --execute` and `pnpm seed`, so judges find a fresh story. Nothing touches the demo accounts after this.
- [ ] **A** `pnpm demo` is not run after the final seed, it spends the story. Check by reading the API only.

## 3. Repo (13 Nov)
- [ ] **A** `pnpm typecheck && pnpm lint && pnpm test` pass, CI green on main.
- [ ] **A** README has no `TODO(deploy)` (checked 12 Nov: none). Disclosures from docs/DEMO.md section 9 are in the README.
- [ ] **H** Make the repo public. The video's closing screen shows `github.com/Im-A-Nuel/promise`, so do it before posting the video.

## 4. Post and submit (14 Nov, by 12:00 UTC)
- [ ] **H** Upload the video, post on X with the draft from docs/DEMO.md section 6. Keep the post URL.
- [ ] **H** Create a mainnet NEAR address in a wallet (never a demo account). Send the agent: `leadName`, `email`, `nearAddress`, `projectUrl`, `demoUrl`.
- [ ] **A** Re-read https://nearhackathon.com/HACKATHON.md for changes.
- [ ] **A** Fill the payload from docs/DEMO.md section 7 with those values only. Never invent a value. Generate `requestId` once. Count the `idea` characters (20 to 2000).
- [ ] **A** Print the full JSON payload and the consent sentence.
- [ ] **H** Read it and answer an explicit "yes".
- [ ] **A** One POST to `https://nearhackathon.com/api/applications`. 201 means done, keep the response. 400: fix the fields, resend with the same `requestId`. 409: stop and ask. 403: the window is closed.

## 5. If time runs short
Skip the re-record and keep the current video (`promise-demo.mp4`, v2). It shows the older card. The cost is a mismatch between the video and the live app, not a broken submission. Never skip the final reset and seed.
