//! Phase 3 sandbox tests with the real tUSDC contract: cancel, refund, soulbound.

mod common;

use common::*;
use near_workspaces::types::NearToken;
use serde_json::json;

const HUNDRED: u128 = 100_000_000;

#[tokio::test]
async fn t32_refund_goes_to_the_owner_not_the_caller() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, None).await?;
    assert_eq!(env.balance(budi.id().as_str()).await?, HUNDRED - FIVE);

    // refunds are closed while the hajat is open
    let early = citra
        .call(env.amplop.id(), "refund")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(early).contains("ERR_NOT_REFUNDABLE"));

    ayu.call(env.amplop.id(), "cancel_hajat")
        .args_json(json!({ "hajat_id": h }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.hajat(h).await?["status"], "Cancelled");

    // a stranger pays the gas, budi gets the money
    citra
        .call(env.amplop.id(), "refund")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let inv = env.invitation(t).await?;
    assert_eq!(inv["state"], "Refunded");
    assert_eq!(inv["card_status"], "Refunded");
    assert_eq!(inv["sealed"], "0");
    assert_eq!(env.balance(budi.id().as_str()).await?, HUNDRED);
    assert_eq!(
        env.balance(citra.id().as_str()).await?,
        HUNDRED,
        "caller gains nothing"
    );
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    assert_eq!(env.hajat(h).await?["sealed_total"], "0");

    // and it cannot be refunded twice
    let again = citra
        .call(env.amplop.id(), "refund")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(again).contains("ERR_NOT_REFUNDABLE"));
    Ok(())
}

#[tokio::test]
async fn t33_cancel_after_one_opened() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let tb = env.invite(&ayu, h, &budi).await?;
    let tc = env.invite(&ayu, h, &citra).await?;
    env.seal(&budi, tb, FIVE, None).await?;
    env.seal(&citra, tc, FIVE, None).await?;

    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": tb }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let res = ayu
        .call(env.amplop.id(), "cancel_hajat")
        .args_json(json!({ "hajat_id": h }))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_HAS_OPENED"));
    assert_eq!(env.hajat(h).await?["status"], "Open");
    // citra's envelope is untouched and the contract still holds exactly that
    assert_eq!(env.invitation(tc).await?["state"], "Sealed");
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, FIVE);
    Ok(())
}

#[tokio::test]
async fn t36_refund_to_an_unregistered_owner_rolls_back() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    // budi seals everything and then closes their tUSDC account (allowed at balance 0)
    env.seal(&budi, t, HUNDRED, None).await?;
    let unregistered: bool = budi
        .call(env.tusdc.id(), "storage_unregister")
        .args_json(json!({}))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .json()?;
    assert!(unregistered);

    ayu.call(env.amplop.id(), "cancel_hajat")
        .args_json(json!({ "hajat_id": h }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let res = ayu
        .call(env.amplop.id(), "refund")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?;
    assert!(res.is_success());
    assert!(
        res.logs().iter().any(|l| l.contains("refund_failed")),
        "logs: {:?}",
        res.logs()
    );
    assert_eq!(env.invitation(t).await?["state"], "Sealed");
    assert_eq!(
        env.balance(env.amplop.id().as_str()).await?,
        HUNDRED,
        "tokens are safe"
    );

    // budi registers again and the same refund goes through
    env.register_on_tusdc(budi.id().as_str()).await?;
    ayu.call(env.amplop.id(), "refund")
        .args_json(json!({ "token_id": t }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.invitation(t).await?["state"], "Refunded");
    assert_eq!(env.balance(budi.id().as_str()).await?, HUNDRED);
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    Ok(())
}

#[tokio::test]
async fn t28_nft_transfer_is_always_refused() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.user("citra").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;

    let res = budi
        .call(env.amplop.id(), "nft_transfer")
        .args_json(json!({ "receiver_id": citra.id(), "token_id": t.to_string() }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_SOULBOUND"));

    let res = budi
        .call(env.amplop.id(), "nft_transfer_call")
        .args_json(json!({ "receiver_id": citra.id(), "token_id": t.to_string(), "msg": "" }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result();
    assert!(error_text(res).contains("ERR_SOULBOUND"));

    // even the host cannot move it, and ownership did not change
    let tok: serde_json::Value = env
        .amplop
        .view("nft_token")
        .args_json(json!({ "token_id": t.to_string() }))
        .await?
        .json()?;
    assert_eq!(tok["owner_id"], budi.id().as_str());
    Ok(())
}

#[tokio::test]
async fn nft_views_for_wallets() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let t = env.invite(&ayu, h, &budi).await?;
    env.seal(&budi, t, FIVE, Some("Selamat")).await?;

    let owned: Vec<serde_json::Value> = env
        .amplop
        .view("nft_tokens_for_owner")
        .args_json(json!({ "account_id": budi.id() }))
        .await?
        .json()?;
    assert_eq!(owned.len(), 1);
    assert_eq!(owned[0]["token_id"], t.to_string());
    assert_eq!(
        owned[0]["metadata"]["description"],
        "Sealed. Opens at the event."
    );
    assert!(!owned[0]["metadata"]["extra"]
        .as_str()
        .unwrap_or("")
        .contains("5000000"));

    let supply: String = env.amplop.view("nft_total_supply").await?.json()?;
    assert_eq!(supply, "1");
    let meta: serde_json::Value = env.amplop.view("nft_metadata").await?.json()?;
    assert_eq!(meta["spec"], "nft-1.0.0");
    Ok(())
}
