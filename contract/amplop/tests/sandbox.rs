//! Sandbox tests with the real tUSDC contract (docs/CONTRACTS.md section 12).
//!
//! Needs both wasm files first: `pnpm contracts:build`.
//! Override the paths with AMPLOP_WASM and TUSDC_WASM.

mod common;

use common::*;
use near_workspaces::types::NearToken;
use serde_json::json;

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
