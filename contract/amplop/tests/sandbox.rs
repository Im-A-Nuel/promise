//! Sandbox tests with the real tUSDC contract (docs/CONTRACTS.md section 12).
//!
//! Needs both wasm files first: `pnpm contracts:build`.
//! Override the paths with AMPLOP_WASM and TUSDC_WASM.

use near_workspaces::network::Sandbox;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::{json, Value};

type TestResult<T> = Result<T, Box<dyn std::error::Error>>;

const FIVE: u128 = 5_000_000;
const HOUR_MS: u64 = 3_600_000;
const DAY_MS: u64 = 86_400_000;

fn wasm(var: &str, default: &str) -> TestResult<Vec<u8>> {
    let path = std::env::var(var).unwrap_or_else(|_| default.to_string());
    Ok(std::fs::read(path)?)
}

struct Env {
    worker: Worker<Sandbox>,
    root: Account,
    tusdc: Contract,
    amplop: Contract,
}

async fn setup() -> TestResult<Env> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;

    let tusdc_acc = root
        .create_subaccount("tusdc")
        .initial_balance(NearToken::from_near(20))
        .transact()
        .await?
        .into_result()?;
    let tusdc = tusdc_acc
        .deploy(&wasm("TUSDC_WASM", "../target/near/tusdc/tusdc.wasm")?)
        .await?
        .into_result()?;
    tusdc
        .call("new")
        .args_json(json!({ "owner_id": root.id() }))
        .transact()
        .await?
        .into_result()?;

    let amplop_acc = root
        .create_subaccount("amplop")
        .initial_balance(NearToken::from_near(20))
        .transact()
        .await?
        .into_result()?;
    let amplop = amplop_acc
        .deploy(&wasm("AMPLOP_WASM", "../target/near/amplop/amplop.wasm")?)
        .await?
        .into_result()?;
    amplop
        .call("new")
        .args_json(json!({
            "owner_id": root.id(),
            "ft_id": tusdc.id(),
            "app_url": "https://promise.example",
        }))
        .transact()
        .await?
        .into_result()?;

    let env = Env {
        worker,
        root,
        tusdc,
        amplop,
    };
    env.register_on_tusdc(env.amplop.id().as_str()).await?;
    Ok(env)
}

impl Env {
    async fn user(&self, name: &str) -> TestResult<Account> {
        Ok(self
            .root
            .create_subaccount(name)
            .initial_balance(NearToken::from_near(10))
            .transact()
            .await?
            .into_result()?)
    }

    /// A user who already holds 100 tUSDC (the faucet also registers them).
    async fn funded_user(&self, name: &str) -> TestResult<Account> {
        let u = self.user(name).await?;
        u.call(self.tusdc.id(), "faucet")
            .transact()
            .await?
            .into_result()?;
        Ok(u)
    }

    async fn register_on_tusdc(&self, account_id: &str) -> TestResult<()> {
        self.root
            .call(self.tusdc.id(), "storage_deposit")
            .args_json(json!({ "account_id": account_id, "registration_only": true }))
            .deposit(NearToken::from_millinear(10))
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    async fn now_ms(&self) -> TestResult<u64> {
        Ok(self.worker.view_block().await?.timestamp() / 1_000_000)
    }

    async fn balance(&self, account_id: &str) -> TestResult<u128> {
        let s: String = self
            .tusdc
            .view("ft_balance_of")
            .args_json(json!({ "account_id": account_id }))
            .await?
            .json()?;
        Ok(s.parse()?)
    }

    async fn create_hajat(&self, host: &Account, event_in_ms: u64) -> TestResult<u64> {
        let event_at = self.now_ms().await? + event_in_ms;
        let id: String = host
            .call(self.amplop.id(), "create_hajat")
            .args_json(json!({
                "title": "Pernikahan Ayu & Bima",
                "kind": "Wedding",
                "venue": "Gedung",
                "event_at_ms": event_at,
                "join_policy": "InviteOnly",
            }))
            .deposit(NearToken::from_millinear(50))
            .max_gas()
            .transact()
            .await?
            .into_result()?
            .json()?;
        Ok(id.parse()?)
    }

    async fn invite(&self, host: &Account, hajat: u64, guest: &Account) -> TestResult<u64> {
        let id: String = host
            .call(self.amplop.id(), "invite")
            .args_json(
                json!({ "hajat_id": hajat, "guest": guest.id(), "label": guest.id().as_str() }),
            )
            .deposit(NearToken::from_millinear(20))
            .max_gas()
            .transact()
            .await?
            .into_result()?
            .json()?;
        Ok(id.parse()?)
    }

    /// Guest seals through the real `ft_transfer_call`.
    async fn seal(
        &self,
        guest: &Account,
        token: u64,
        amount: u128,
        note: Option<&str>,
    ) -> TestResult<()> {
        let msg = match note {
            Some(n) => json!({ "token_id": token.to_string(), "note": n }),
            None => json!({ "token_id": token.to_string() }),
        };
        guest
            .call(self.tusdc.id(), "ft_transfer_call")
            .args_json(json!({
                "receiver_id": self.amplop.id(),
                "amount": amount.to_string(),
                "msg": msg.to_string(),
            }))
            .deposit(NearToken::from_yoctonear(1))
            .max_gas()
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    async fn invitation(&self, token: u64) -> TestResult<Value> {
        Ok(self
            .amplop
            .view("get_invitation")
            .args_json(json!({ "token_id": token }))
            .await?
            .json()?)
    }

    async fn hajat(&self, id: u64) -> TestResult<Value> {
        Ok(self
            .amplop
            .view("get_hajat")
            .args_json(json!({ "hajat_id": id }))
            .await?
            .json()?)
    }
}

fn error_text<T: std::fmt::Debug, E: std::fmt::Debug>(r: Result<T, E>) -> String {
    match r {
        Ok(v) => format!("unexpected success: {v:?}"),
        Err(e) => format!("{e:?}"),
    }
}

#[tokio::test]
async fn t11_seal_moves_real_tokens_into_the_contract() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    env.seal(&budi, t, FIVE, Some("Selamat ya")).await?;

    let inv = env.invitation(t).await?;
    assert_eq!(inv["state"], "Sealed");
    assert_eq!(inv["sealed"], "5000000");
    assert_eq!(inv["note"], "Selamat ya");
    assert_eq!(env.hajat(h).await?["sealed_total"], "5000000");
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, FIVE);
    assert_eq!(env.balance(budi.id().as_str()).await?, 100_000_000 - FIVE);
    Ok(())
}

#[tokio::test]
async fn t13_t14_bad_seals_are_refunded_by_the_token() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    // T-13: citra tries to seal into budi's invitation
    env.seal(&citra, t, FIVE, None).await?;
    assert_eq!(env.balance(citra.id().as_str()).await?, 100_000_000);
    // T-14: below the 0.01 tUSDC minimum
    env.seal(&budi, t, 9_999, None).await?;
    assert_eq!(env.balance(budi.id().as_str()).await?, 100_000_000);
    // bad message
    budi.call(env.tusdc.id(), "ft_transfer_call")
        .args_json(json!({ "receiver_id": env.amplop.id(), "amount": "20000", "msg": "nonsense" }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.balance(budi.id().as_str()).await?, 100_000_000);

    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    assert_eq!(env.invitation(t).await?["state"], "Invited");
    Ok(())
}

#[tokio::test]
async fn t15_ft_on_transfer_from_a_stranger_panics() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    let res = budi
        .call(env.amplop.id(), "ft_on_transfer")
        .args_json(json!({
            "sender_id": budi.id(),
            "amount": FIVE.to_string(),
            "msg": json!({ "token_id": t.to_string() }).to_string(),
        }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_WRONG_TOKEN"));
    Ok(())
}

#[tokio::test]
async fn t16_check_in_before_the_window() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 30 * DAY_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;

    let res = ayu
        .call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_TOO_EARLY"));
    assert_eq!(env.invitation(t).await?["state"], "Sealed");
    Ok(())
}

#[tokio::test]
async fn t17_check_in_pays_the_host() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;
    let host_before = env.balance(ayu.id().as_str()).await?;

    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let inv = env.invitation(t).await?;
    assert_eq!(inv["state"], "Opened");
    assert_eq!(inv["checked_in"], true);
    assert_eq!(inv["sealed"], "0");
    assert_eq!(inv["released"], "5000000");
    assert_eq!(env.balance(ayu.id().as_str()).await?, host_before + FIVE);
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    let hajat = env.hajat(h).await?;
    assert_eq!(hajat["sealed_total"], "0");
    assert_eq!(hajat["released_total"], "5000000");
    Ok(())
}

#[tokio::test]
async fn t17_gas_stays_within_budget() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;

    let res = ayu
        .call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .gas(near_workspaces::types::Gas::from_tgas(120))
        .transact()
        .await?;
    println!(
        "check_in burnt {} Tgas",
        res.total_gas_burnt.as_gas() / 1_000_000_000_000
    );
    assert!(
        res.is_success(),
        "check_in should work with exactly the minimum gas"
    );
    assert_eq!(env.invitation(t).await?["state"], "Opened");
    Ok(())
}

#[tokio::test]
async fn t18_stranger_cannot_open_before_the_auto_window() -> TestResult<()> {
    // The "after event_at + 24h" half needs a 24 hour clock jump. `fast_forward` over that many
    // blocks does not finish in reasonable time, so the exact boundary (event_at + 24h - 1 ms is
    // rejected, event_at + 24h is accepted) is covered by the unit tests in src/tests/escrow.rs.
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    // the host window is open, but the public window is a day after the event
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;

    let res = citra
        .call(env.amplop.id(), "open")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_TOO_EARLY"));
    assert_eq!(env.invitation(t).await?["state"], "Sealed");
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, FIVE);

    // the host can open in the same moment
    ayu.call(env.amplop.id(), "open")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.invitation(t).await?["state"], "Opened");
    Ok(())
}

#[tokio::test]
async fn t19_unregistered_host_rolls_back_to_sealed() -> TestResult<()> {
    let env = setup().await?;
    // eko never called the faucet, so tUSDC has no account for them
    let eko = env.user("eko").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&eko, 12 * HOUR_MS).await?;
    let t = env.invite(&eko, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;

    let res = eko
        .call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?;
    assert!(
        res.is_success(),
        "the call itself succeeds, only the inner transfer fails"
    );
    assert!(
        res.logs().iter().any(|l| l.contains("open_failed")),
        "logs: {:?}",
        res.logs()
    );

    let inv = env.invitation(t).await?;
    assert_eq!(inv["state"], "Sealed");
    assert_eq!(inv["sealed"], "5000000");
    assert_eq!(
        env.balance(env.amplop.id().as_str()).await?,
        FIVE,
        "tokens are still in the contract"
    );
    assert_eq!(env.hajat(h).await?["released_total"], "0");

    // once eko is registered the same check-in works
    env.register_on_tusdc(eko.id().as_str()).await?;
    eko.call(env.amplop.id(), "open")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.invitation(t).await?["state"], "Opened");
    assert_eq!(env.balance(eko.id().as_str()).await?, FIVE);
    Ok(())
}

#[tokio::test]
async fn callback_is_private() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let res = ayu
        .call(env.amplop.id(), "on_open_resolved")
        .args_json(json!({ "token_id": 1, "amount": "1" }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("private"));
    Ok(())
}
