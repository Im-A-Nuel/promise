# Testnet Deployment Runbook

Last updated: 2026-11-09. Everything here targets NEAR testnet. Nothing touches mainnet.

CLI syntax changes between releases. Before running a command, check it with `--help` (for example `cargo near deploy --help`). Commands marked "verified" appear in the current NEAR docs.

## 1. Tooling

| Tool | Version | Install |
| --- | --- | --- |
| Rust | stable, with target `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown` |
| cargo-near | latest | `cargo install cargo-near` |
| near-cli-rs | latest | `npm install -g near-cli-rs@latest` (verified) |
| Node | 22 LTS | nvm or fnm |
| pnpm | 9.x | `corepack enable` |
| Docker | optional | only for reproducible builds |

Pin exact library versions in the lockfiles after checking `npm view <pkg> version` and `cargo search near-sdk`. For anything published as a script from a CDN, pin to a version at least two weeks old.

## 2. Accounts

Names assume `promisedemo.testnet` is free. If not, choose another root and set `ROOT_ACCOUNT` in `.env.deploy`. Update the README placeholders after.

| Account | Role | Funding (NEAR) |
| --- | --- | --- |
| `promisedemo.testnet` | root, deployer, pays for sub-accounts | from faucet |
| `tusdc.promisedemo.testnet` | token contract | 3 |
| `amplop.promisedemo.testnet` | main contract | 8 |
| `ayu` `budi` `citra` `dewi` `eko` `.promisedemo.testnet` | personas | 1 each |
| `relayer.promisedemo.testnet` (P2) | pays gas for delegates | 5 |

Budget: about 16 NEAR for P0, 21 with the relayer. Contract accounts need headroom because storage staking locks NEAR, and the `tusdc` faucet pays registration for new users. If the faucet gives less, fund personas with 0.5 NEAR and shrink the headroom, then top up later. Create the root through the faucet (verified):

```bash
near account create-account sponsor-by-faucet-service promisedemo.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

Check what you got: `near account view-account-summary promisedemo.testnet network-config testnet now`.

## 3. One-command path

```bash
cp .env.deploy.example .env.deploy        # fill ROOT_ACCOUNT and ROOT_PRIVATE_KEY
pnpm contracts:build
pnpm deploy:testnet
pnpm seed
pnpm demo                                  # smoke test, prints explorer links
```

`scripts/deploy.ts` does, in order, and is safe to re-run:

1. Create sub-accounts that do not exist yet (contracts and personas), generating persona key pairs on first run.
2. Deploy `tusdc` and call `new`.
3. Deploy `amplop` and call `new(owner_id, ft_id, app_url)`.
4. Register `amplop`, the host personas and the relayer on `tusdc` with `storage_deposit`.
5. `mint` 500 tUSDC to each persona.
6. Write `frontend/.env.local` and `frontend/src/lib/demo/personas.public.json`.
7. Call `get_config` on `amplop` and `ft_metadata` on `tusdc` and fail loudly if either is wrong.

`scripts/seed.ts` creates the story in DEMO.md section 1 with event times relative to now (host window already open), then prints the transaction list to paste into DEMO.md.

## 4. Manual path (what the script runs)

Create a sub-account (adjust to your CLI version):

```bash
near account create-account fund-myself tusdc.promisedemo.testnet '3 NEAR' autogenerate-new-keypair save-to-keychain sign-as promisedemo.testnet network-config testnet sign-with-keychain send
```

Build and deploy with init (flag names may differ, run `cargo near deploy --help`):

```bash
cd contract/tusdc
cargo near deploy build-non-reproducible-wasm tusdc.promisedemo.testnet \
  with-init-call new json-args '{"owner_id":"promisedemo.testnet"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send

cd ../amplop
cargo near deploy build-non-reproducible-wasm amplop.promisedemo.testnet \
  with-init-call new json-args '{"owner_id":"promisedemo.testnet","ft_id":"tusdc.promisedemo.testnet","app_url":"https://YOUR_APP_URL"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

Call a method (verified shape):

```bash
near contract call-function as-transaction tusdc.promisedemo.testnet faucet json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as budi.promisedemo.testnet network-config testnet sign-with-keychain send
```

Read state (verified shape):

```bash
near contract call-function as-read-only amplop.promisedemo.testnet get_config json-args '{}' network-config testnet now
```

## 5. Web app

Local:

```bash
cp frontend/.env.example frontend/.env.local
pnpm dev
```

Vercel: import the GitHub repo, set Root Directory to `frontend`, framework Next.js, install command `pnpm install`, add the variables from SCHEMA.md. Use the Vercel production URL as `NEXT_PUBLIC_APP_URL`, redeploy the web app, then point the contract at it with `set_app_url` (owner only): `near contract call-function as-transaction amplop.promisedemo.testnet set_app_url json-args '{"url":"https://YOUR_APP_URL"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as promisedemo.testnet network-config testnet sign-with-keychain send`.

Custom domain is optional. Prefer the default `*.vercel.app` URL to avoid DNS surprises on deadline day.

## 6. CI

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: wasm32-unknown-unknown }
      - run: cargo install cargo-near --locked
      - run: cd contract && cargo test --workspace
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck && pnpm lint && pnpm build
```

Sandbox tests download a NEAR sandbox binary on first run, so allow a few minutes in CI.

## 7. Verification checklist after deploy

Run these and keep the output for DEMO.md.

```bash
near contract call-function as-read-only amplop.promisedemo.testnet get_config json-args '{}' network-config testnet now
near contract call-function as-read-only amplop.promisedemo.testnet get_hajats json-args '{"from":0,"limit":5}' network-config testnet now
near contract call-function as-read-only amplop.promisedemo.testnet nft_token json-args '{"token_id":"1"}' network-config testnet now
curl -s $NEXT_PUBLIC_APP_URL/api/health
curl -s $NEXT_PUBLIC_APP_URL/api/nft/1 | head -c 300
```

Then open `/demo` in a private window, switch personas, and run the 7 steps once by hand.

## 8. Repo hygiene before going public

- `git log --reverse | head` shows the first commit date. It should be on or after 2026-11-01 if you want that line to match the hackathon window.
- `git grep -nE "ed25519:[A-Za-z0-9]{40,}"` returns only `personas.public.json`. Anything else is a leak.
- No `.env`, `.env.deploy`, `target/`, or `node_modules/` committed. `.gitignore` covers them.
- README has no `TODO(deploy)` left. Search for it.
- Add `LICENSE` (MIT).
- Repo public before 2026-11-14T23:59:00Z. Making it public is your action, not the agent's.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Smart contract panicked: The account X is not registered` on open | Host not registered on tUSDC | Host calls `faucet` or `storage_deposit`, then retry |
| `Exceeded the prepaid gas` | Gas below 100 Tgas for `ft_transfer_call` or 120 for open | Raise gas; client defaults already do |
| `LackBalanceForState` on deploy | Account has too little NEAR for the wasm | Fund the contract account, or `cargo near build` with size optimizations |
| Faucet says daily limit reached | Faucet throttling | Wait, or use another faucet account and transfer NEAR |
| Wasm too big | Debug symbols or default profile | `opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, strip symbols |
| Cards show stale state | RPC lag | Wait 2 to 4 seconds; the UI polls |
| Persona signs but nothing happens | Persona out of NEAR | Re-run `pnpm deploy:testnet`, it tops up personas below 0.2 NEAR |
| `near` command not found | CLI not installed | `npm install -g near-cli-rs@latest` |

## 9b. If testnet is down on demo day

Judges need something. Keep two fallbacks ready:

1. Screenshots and a 90 second screen recording in `docs/assets/` (committed).
2. A saved JSON of every `nft_token` response from the seed in `docs/assets/cards/`, plus the NearBlocks links in DEMO.md, so the claims can still be checked later.

## 10. Rollback

There is no migration. To roll back, redeploy the previous wasm with `cargo near deploy ... without-init-call` (state is kept, but only if the struct layout did not change) or redeploy to fresh sub-accounts and reseed. During the hackathon the second option is safer. Freeze contracts on 2026-11-13.
