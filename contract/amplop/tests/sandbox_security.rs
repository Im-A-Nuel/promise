//! Findings from the pre-deploy review, each pinned by a test.
//! F-1: the contract pays storage for seals and ledger entries. If its NEAR runs low, the open
//! callback must not be able to fail after the tUSDC has already moved.
//! F-2: gas of the heaviest view (50 cards) stays far below the 200 Tgas view limit.

mod common;

use common::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

const UNIT: u128 = 1_000_000;

/// NEAR left over after storage staking, in yocto.
async fn spare(env: &Env) -> TestResult<u128> {
    let d = env.amplop.view_account().await?;
    let locked = u128::from(d.storage_usage) * 10u128.pow(19);
    Ok(d.balance.as_yoctonear().saturating_sub(locked))
}

/// Moves NEAR out of the amplop account until only `keep_yocto` of spare balance is left.
async fn drain_to(env: &Env, keep_yocto: u128) -> TestResult<()> {
    let have = spare(env).await?;
    let take = have.saturating_sub(keep_yocto);
    env.amplop
        .as_account()
        .transfer_near(env.root.id(), NearToken::from_yoctonear(take))
        .await?
        .into_result()?;
    Ok(())
}

#[tokio::test]
async fn f1_low_contract_balance_never_strands_a_token_in_opening() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let tb = env.invite(&ayu, h, &budi).await?;
    let tc = env.invite(&ayu, h, &citra).await?;
    env.seal(&budi, tb, 5 * UNIT, None).await?;

    // About 0.003 NEAR of room: too little for the ledger entries an opening adds.
    drain_to(&env, 3 * 10u128.pow(21)).await?;
    println!("spare before check_in: {} yocto", spare(&env).await?);

    let res = ayu
        .call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": tb }))
        .max_gas()
        .transact()
        .await?;
    let inv = env.invitation(tb).await?;
    println!("state after check_in: {}", inv["state"]);
    assert_ne!(
        inv["state"],
        "Opening",
        "token stranded in Opening while the host already got the money (host balance {})",
        env.balance(ayu.id().as_str()).await?
    );
    assert_eq!(
        inv["state"], "Sealed",
        "the opening must be refused before any money moves"
    );
    assert!(error_text(res.into_result()).contains("ERR_LOW_BALANCE"));
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 5 * UNIT);

    // a new seal is handed back instead of growing storage the contract cannot pay for
    env.seal(&citra, tc, 3 * UNIT, None).await?;
    assert_eq!(env.invitation(tc).await?["state"], "Invited");
    assert_eq!(env.balance(citra.id().as_str()).await?, 100 * UNIT);

    // after a top-up everything works again
    env.root
        .transfer_near(env.amplop.id(), NearToken::from_near(1))
        .await?
        .into_result()?;
    ayu.call(env.amplop.id(), "check_in")
        .args_json(json!({ "token_id": tb }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.invitation(tb).await?["state"], "Opened");
    env.seal(&citra, tc, 3 * UNIT, None).await?;
    assert_eq!(env.invitation(tc).await?["state"], "Sealed");
    Ok(())
}

#[tokio::test]
async fn f2_viewing_fifty_cards_fits_the_view_gas_limit() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    for batch in 0..3 {
        let items: Vec<_> = (0..20)
            .map(|i| json!({ "guest": format!("g{}.test.near", batch * 20 + i), "label": format!("Guest {}", batch * 20 + i) }))
            .collect();
        ayu.call(env.amplop.id(), "invite_many")
            .args_json(json!({ "hajat_id": h, "items": items }))
            .deposit(NearToken::from_millinear(300))
            .max_gas()
            .transact()
            .await?
            .into_result()?;
    }
    // View methods can also be called as transactions, which reports the gas they burn.
    let res = ayu
        .call(env.amplop.id(), "nft_tokens")
        .args_json(json!({ "limit": 50 }))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;
    assert!(res.is_success());
    let burnt = res.total_gas_burnt.as_gas() / 1_000_000_000_000;
    println!("nft_tokens(limit 50) burnt {burnt} Tgas");
    assert!(
        burnt < 100,
        "50 cards burnt {burnt} Tgas, the view limit is 200"
    );
    Ok(())
}
