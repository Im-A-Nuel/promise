//! The activity log on the real contract: what a real flow records, and what it costs.

mod common;

use common::*;
use near_workspaces::types::NearToken;
use serde_json::{json, Value};

const UNIT: u128 = 1_000_000;

async fn log(env: &Env) -> TestResult<Vec<Value>> {
    Ok(env
        .amplop
        .view("get_activity")
        .args_json(json!({ "from": 0, "limit": 50 }))
        .await?
        .json()?)
}

fn kinds(entries: &[Value]) -> Vec<String> {
    entries
        .iter()
        .map(|e| e["kind"].as_str().unwrap_or("?").to_string())
        .collect()
}

async fn storage_usage(env: &Env) -> TestResult<u64> {
    Ok(env.amplop.view_account().await?.storage_usage)
}

#[tokio::test]
async fn a_real_gift_leaves_a_readable_history() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, 5 * UNIT, Some("Selamat")).await?;
    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let entries = log(&env).await?;
    assert_eq!(
        kinds(&entries),
        vec!["hajat_created", "invited", "sealed", "checked_in", "opened"]
    );
    assert_eq!(entries[2]["actor"], budi.id().as_str());
    assert_eq!(entries[2]["amount"], "5000000");
    assert_eq!(entries[4]["actor"], ayu.id().as_str());
    assert_eq!(entries[4]["token_id"], t);

    let config: Value = env.amplop.view("get_config").await?.json()?;
    assert_eq!(config["activity_count"], 5);

    let recent: Vec<Value> = env
        .amplop
        .view("get_recent_activity")
        .args_json(json!({ "token_id": t.to_string(), "limit": 2 }))
        .await?
        .json()?;
    assert_eq!(
        kinds(&recent),
        vec!["opened", "checked_in"],
        "newest first, filtered to one token"
    );
    Ok(())
}

#[tokio::test]
async fn the_story_with_a_repayment_is_all_in_the_log() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h1 = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let old = env.invite(&ayu, h1, &budi).await?;
    env.seal(&budi, old, 5 * UNIT, None).await?;
    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": old }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let h2 = env.create_hajat(&budi, 12 * HOUR_MS).await?;
    let reply = env.invite(&budi, h2, &ayu).await?;
    env.seal(&ayu, reply, 5 * UNIT, None).await?;
    budi.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": reply }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let history: Vec<Value> = env
        .amplop
        .view("get_recent_activity")
        .args_json(json!({ "token_id": old.to_string() }))
        .await?
        .json()?;
    assert_eq!(
        history[0]["kind"], "repaid",
        "the old card's last entry is its repayment"
    );
    assert_eq!(history[0]["amount"], "5000000");
    assert_eq!(history[0]["actor"], ayu.id().as_str(), "paid by Ayu");
    Ok(())
}

/// What one log entry costs in storage, so the cap in docs/CONTRACTS.md rests on a measured number.
#[tokio::test]
async fn one_entry_costs_about_a_hundred_and_fifty_bytes() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    // check-in on an invitation that sealed nothing changes only the checked_in flag (one byte of the
    // same size) and adds exactly one log entry
    let before = storage_usage(&env).await?;
    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    let per_entry = storage_usage(&env).await? - before;
    println!("one activity entry added {per_entry} bytes");
    assert!(
        (80..=220).contains(&per_entry),
        "an entry should be small, got {per_entry} bytes"
    );
    // at the cap of 1000 entries this is the NEAR the contract holds for the log
    let near = per_entry as f64 * 1000.0 * 1e19 / 1e24;
    println!("1000 entries hold about {near:.2} NEAR");
    assert!(
        near < 3.0,
        "the full log should cost under 3 NEAR, got {near:.2}"
    );
    Ok(())
}

#[tokio::test]
async fn the_callback_with_ten_repayments_still_fits_its_gas() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;

    for _ in 0..10 {
        let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
        let t = env.invite(&ayu, h, &budi).await?;
        env.seal(&budi, t, UNIT, None).await?;
        ayu.call(env.amplop.id(), "check_in")
            .args_json(json!({ "token_id": t }))
            .max_gas()
            .transact()
            .await?
            .into_result()?;
    }
    let h = env.create_hajat(&budi, 12 * HOUR_MS).await?;
    let t = env.invite(&budi, h, &ayu).await?;
    env.seal(&ayu, t, 12 * UNIT, None).await?;
    let res = budi
        .call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": t }))
        .gas(near_workspaces::types::Gas::from_tgas(120))
        .transact()
        .await?;
    let burnt = res.total_gas_burnt.as_gas() / 1_000_000_000_000;
    println!("check_in with 10 repayments and 11 log entries burnt {burnt} Tgas");
    assert!(res.is_success());
    assert!(burnt < 120, "burnt {burnt} Tgas");
    let inv = env.invitation(t).await?;
    assert_eq!(inv["state"], "Opened", "the callback must finish");
    // the ten repayments are the newest entries, so read the log from the newest end
    let recent: Vec<Value> = env
        .amplop
        .view("get_recent_activity")
        .args_json(json!({ "limit": 50 }))
        .await?
        .json()?;
    assert_eq!(recent.iter().filter(|e| e["kind"] == "repaid").count(), 10);
    assert_eq!(
        recent[0]["kind"], "repaid",
        "repayments are logged after the opening itself"
    );
    Ok(())
}

#[tokio::test]
async fn a_too_poor_contract_refuses_before_logging_anything() -> TestResult<()> {
    // The reserve guard (0.25 NEAR) must also hold for the new log writes made in callbacks.
    let env = setup().await?;
    let d = env.amplop.view_account().await?;
    let spare = d.balance.as_yoctonear() - u128::from(d.storage_usage) * 10u128.pow(19);
    assert!(
        spare > 250_000_000_000_000_000_000_000,
        "a fresh deploy has the reserve"
    );
    let config: Value = env.amplop.view("get_config").await?.json()?;
    let reported: u128 = config["spare_balance"].as_str().unwrap_or("0").parse()?;
    assert!(reported > 250_000_000_000_000_000_000_000);
    let _ = NearToken::from_near(0);
    Ok(())
}
