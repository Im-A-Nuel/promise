//! Sandbox tests T-37 and T-38 (docs/CONTRACTS.md section 12).
//! Needs the wasm first: `pnpm contracts:build`. Override the path with TUSDC_WASM.

use near_workspaces::{types::NearToken, Account, Contract};
use serde_json::json;

type TestResult<T> = Result<T, Box<dyn std::error::Error>>;

fn wasm_path() -> String {
    std::env::var("TUSDC_WASM").unwrap_or_else(|_| "../target/near/tusdc/tusdc.wasm".to_string())
}

async fn setup() -> TestResult<(near_workspaces::Worker<near_workspaces::network::Sandbox>, Contract, Account)> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = std::fs::read(wasm_path())?;
    let contract = worker.dev_deploy(&wasm).await?;
    let owner = worker.root_account()?;
    contract
        .call("new")
        .args_json(json!({ "owner_id": owner.id() }))
        .transact()
        .await?
        .into_result()?;
    Ok((worker, contract, owner))
}

async fn new_user(owner: &Account, name: &str) -> TestResult<Account> {
    Ok(owner
        .create_subaccount(name)
        .initial_balance(NearToken::from_near(5))
        .transact()
        .await?
        .into_result()?)
}

#[tokio::test]
async fn t37_faucet_twice_within_cooldown_fails() -> TestResult<()> {
    let (_worker, contract, owner) = setup().await?;
    let budi = new_user(&owner, "budi").await?;

    budi.call(contract.id(), "faucet").transact().await?.into_result()?;
    let second = budi.call(contract.id(), "faucet").transact().await?;
    assert!(second.is_failure());
    let msg = format!("{:?}", second.into_result().unwrap_err());
    assert!(msg.contains("ERR_COOLDOWN"), "unexpected error: {msg}");
    Ok(())
}

#[tokio::test]
async fn t38_faucet_registers_new_account() -> TestResult<()> {
    let (_worker, contract, owner) = setup().await?;
    let citra = new_user(&owner, "citra").await?;

    let before: Option<serde_json::Value> = contract
        .view("storage_balance_of")
        .args_json(json!({ "account_id": citra.id() }))
        .await?
        .json()?;
    assert!(before.is_none());

    citra.call(contract.id(), "faucet").transact().await?.into_result()?;

    let balance: String = contract
        .view("ft_balance_of")
        .args_json(json!({ "account_id": citra.id() }))
        .await?
        .json()?;
    assert_eq!(balance, "100000000");

    let after: Option<serde_json::Value> = contract
        .view("storage_balance_of")
        .args_json(json!({ "account_id": citra.id() }))
        .await?
        .json()?;
    assert!(after.is_some());
    Ok(())
}
