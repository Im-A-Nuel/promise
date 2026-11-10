//! Shared sandbox helpers.
#![allow(dead_code)]

use near_workspaces::network::Sandbox;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::{json, Value};

pub type TestResult<T> = Result<T, Box<dyn std::error::Error>>;

pub const FIVE: u128 = 5_000_000;
pub const HOUR_MS: u64 = 3_600_000;
pub const DAY_MS: u64 = 86_400_000;

pub fn wasm(var: &str, default: &str) -> TestResult<Vec<u8>> {
    let path = std::env::var(var).unwrap_or_else(|_| default.to_string());
    Ok(std::fs::read(path)?)
}

pub struct Env {
    pub worker: Worker<Sandbox>,
    pub root: Account,
    pub tusdc: Contract,
    pub amplop: Contract,
}

pub async fn setup() -> TestResult<Env> {
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
    pub async fn user(&self, name: &str) -> TestResult<Account> {
        Ok(self
            .root
            .create_subaccount(name)
            .initial_balance(NearToken::from_near(10))
            .transact()
            .await?
            .into_result()?)
    }

    /// A user who already holds 100 tUSDC (the faucet also registers them).
    pub async fn funded_user(&self, name: &str) -> TestResult<Account> {
        let u = self.user(name).await?;
        u.call(self.tusdc.id(), "faucet")
            .transact()
            .await?
            .into_result()?;
        Ok(u)
    }

    pub async fn register_on_tusdc(&self, account_id: &str) -> TestResult<()> {
        self.root
            .call(self.tusdc.id(), "storage_deposit")
            .args_json(json!({ "account_id": account_id, "registration_only": true }))
            .deposit(NearToken::from_millinear(10))
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    pub async fn now_ms(&self) -> TestResult<u64> {
        Ok(self.worker.view_block().await?.timestamp() / 1_000_000)
    }

    pub async fn balance(&self, account_id: &str) -> TestResult<u128> {
        let s: String = self
            .tusdc
            .view("ft_balance_of")
            .args_json(json!({ "account_id": account_id }))
            .await?
            .json()?;
        Ok(s.parse()?)
    }

    pub async fn create_hajat(&self, host: &Account, event_in_ms: u64) -> TestResult<u64> {
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

    pub async fn invite(&self, host: &Account, hajat: u64, guest: &Account) -> TestResult<u64> {
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
    pub async fn seal(
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

    pub async fn invitation(&self, token: u64) -> TestResult<Value> {
        Ok(self
            .amplop
            .view("get_invitation")
            .args_json(json!({ "token_id": token }))
            .await?
            .json()?)
    }

    pub async fn hajat(&self, id: u64) -> TestResult<Value> {
        Ok(self
            .amplop
            .view("get_hajat")
            .args_json(json!({ "hajat_id": id }))
            .await?
            .json()?)
    }
}

pub fn error_text<T: std::fmt::Debug, E: std::fmt::Debug>(r: Result<T, E>) -> String {
    match r {
        Ok(v) => format!("unexpected success: {v:?}"),
        Err(e) => format!("{e:?}"),
    }
}
