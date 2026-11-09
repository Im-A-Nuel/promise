//! Ledger sandbox tests with the real tUSDC contract: the README story and T-40 (gas).

mod common;

use base64_decode::decode_data_uri;
use common::*;
use near_workspaces::types::Gas;
use near_workspaces::Account;
use serde_json::{json, Value};

const UNIT: u128 = 1_000_000;

mod base64_decode {
    /// Decodes a `data:image/svg+xml;base64,...` string without extra dependencies.
    pub fn decode_data_uri(uri: &str) -> String {
        let b64 = uri
            .strip_prefix("data:image/svg+xml;base64,")
            .expect("data uri");
        const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = Vec::new();
        let (mut acc, mut bits) = (0u32, 0u32);
        for ch in b64.bytes().filter(|b| *b != b'=') {
            let v = T.iter().position(|t| *t == ch).expect("base64 char") as u32;
            acc = (acc << 6) | v;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push((acc >> bits) as u8);
                acc &= (1 << bits) - 1;
            }
        }
        String::from_utf8(out).expect("utf8")
    }
}

impl Env {
    /// Check-in with the minimum gas the contract allows. Returns the full result.
    async fn check_in(
        &self,
        host: &Account,
        token: u64,
    ) -> TestResult<near_workspaces::result::ExecutionFinalResult> {
        Ok(host
            .call(self.amplop.id(), "check_in")
            .args_json(json!({ "token_id": token }))
            .gas(Gas::from_tgas(120))
            .transact()
            .await?)
    }

    async fn ledger(&self, account: &Account) -> TestResult<Value> {
        Ok(self
            .amplop
            .view("get_ledger")
            .args_json(json!({ "account_id": account.id() }))
            .await?
            .json()?)
    }

    async fn card(&self, token: u64) -> TestResult<String> {
        let tok: Value = self
            .amplop
            .view("nft_token")
            .args_json(json!({ "token_id": token.to_string() }))
            .await?
            .json()?;
        Ok(decode_data_uri(
            tok["metadata"]["media"].as_str().unwrap_or_default(),
        ))
    }
}

fn owes(ledger: &Value, key: &str) -> Vec<(String, String)> {
    ledger[key]
        .as_array()
        .map(|rows| {
            rows.iter()
                .map(|r| {
                    (
                        r["counterparty"].as_str().unwrap_or_default().to_string(),
                        r["remaining"].as_str().unwrap_or_default().to_string(),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tokio::test]
async fn the_readme_story_on_real_tokens() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;
    let citra = env.funded_user("citra").await?;
    let dewi = env.funded_user("dewi").await?;

    // steps 1 to 4: Ayu's wedding
    let h1 = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
    let tb = env.invite(&ayu, h1, &budi).await?;
    let tc = env.invite(&ayu, h1, &citra).await?;
    let td = env.invite(&ayu, h1, &dewi).await?;
    env.seal(&budi, tb, 5 * UNIT, None).await?;
    env.seal(&citra, tc, 2 * UNIT, None).await?;
    env.seal(&dewi, td, 5 * UNIT, Some("Selamat ya")).await?;
    assert!(env.card(td).await?.contains(">SEALED</text>"));
    assert!(
        !env.card(td).await?.contains("5.00"),
        "amount hidden while sealed"
    );
    for t in [tb, tc, td] {
        env.check_in(&ayu, t).await?.into_result()?;
    }
    assert!(env.card(td).await?.contains("5.00 tUSDC"));

    let ledger = env.ledger(&ayu).await?;
    let mut owed = owes(&ledger, "i_owe");
    owed.sort();
    let expect = |a: &Account, v: u128| (a.id().to_string(), v.to_string());
    assert_eq!(
        owed,
        vec![
            expect(&budi, 5 * UNIT),
            expect(&citra, 2 * UNIT),
            expect(&dewi, 5 * UNIT)
        ]
    );
    assert!(owes(&ledger, "owed_to_me").is_empty());

    // steps 5 to 7: Budi's event, Ayu pays back what the ledger says
    let h2 = env.create_hajat(&budi, 12 * HOUR_MS).await?;
    let ta = env.invite(&budi, h2, &ayu).await?;
    let suggested: String = env
        .amplop
        .view("suggest_reply")
        .args_json(json!({ "hajat_id": h2, "guest": ayu.id() }))
        .await?
        .json()?;
    assert_eq!(suggested, "5000000");
    env.seal(&ayu, ta, suggested.parse()?, None).await?;
    env.check_in(&budi, ta).await?.into_result()?;

    let old = env.invitation(tb).await?;
    assert_eq!(old["card_status"], "Repaid");
    assert_eq!(old["reciprocated"], "5000000");
    assert!(env.card(tb).await?.contains(">REPAID</text>"));
    let reply = env.invitation(ta).await?;
    assert_eq!(reply["card_status"], "Reply");
    assert_eq!(reply["settled"], "5000000");
    assert!(env.card(ta).await?.contains(">REPLY</text>"));

    let after = env.ledger(&ayu).await?;
    let mut owed = owes(&after, "i_owe");
    owed.sort();
    assert_eq!(
        owed,
        vec![expect(&citra, 2 * UNIT), expect(&dewi, 5 * UNIT)]
    );
    assert!(owes(&env.ledger(&budi).await?, "owed_to_me").is_empty());

    // money check: Budi holds what he gave away minus what he received, Ayu the reverse
    assert_eq!(
        env.balance(budi.id().as_str()).await?,
        100 * UNIT - 5 * UNIT + 5 * UNIT
    );
    assert_eq!(
        env.balance(ayu.id().as_str()).await?,
        100 * UNIT + 12 * UNIT - 5 * UNIT
    );
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    Ok(())
}

// T-40: the gas of an opening that repays ten older claims.
#[tokio::test]
async fn t40_open_with_ten_repayments_fits_in_the_gas_budget() -> TestResult<()> {
    let env = setup().await?;
    let ayu = env.funded_user("ayu").await?;
    let budi = env.funded_user("budi").await?;

    // Budi gave 1 tUSDC at each of ten events Ayu hosted
    let mut old = Vec::new();
    for _ in 0..10 {
        let h = env.create_hajat(&ayu, 12 * HOUR_MS).await?;
        let t = env.invite(&ayu, h, &budi).await?;
        env.seal(&budi, t, UNIT, None).await?;
        env.check_in(&ayu, t).await?.into_result()?;
        old.push(t);
    }
    let pair: Value = env
        .amplop
        .view("get_pair")
        .args_json(json!({ "giver": budi.id(), "receiver": ayu.id() }))
        .await?
        .json()?;
    assert_eq!(pair["remaining"], "10000000");
    assert_eq!(pair["open"].as_array().map(Vec::len), Some(10));

    // Now Ayu gives 12 at Budi's event: ten claims repaid, 2 left as new credit
    let h = env.create_hajat(&budi, 12 * HOUR_MS).await?;
    let t = env.invite(&budi, h, &ayu).await?;
    env.seal(&ayu, t, 12 * UNIT, None).await?;
    let res = env.check_in(&budi, t).await?;
    let burnt = res.total_gas_burnt.as_gas() / 1_000_000_000_000;
    println!("check_in with 10 repayments burnt {burnt} Tgas (prepaid 120)");
    assert!(res.is_success(), "{:?}", res.logs());
    assert!(burnt < 120, "burnt {burnt} Tgas");

    let inv = env.invitation(t).await?;
    assert_eq!(
        inv["state"], "Opened",
        "the callback must finish, not leave the token Opening"
    );
    assert_eq!(inv["settled"], "10000000");
    assert_eq!(inv["repays"].as_array().map(Vec::len), Some(10));
    for id in &old {
        assert_eq!(env.invitation(*id).await?["card_status"], "Repaid");
    }
    // the surplus is a claim the other way round: Budi owes Ayu 2
    let back: Value = env
        .amplop
        .view("get_pair")
        .args_json(json!({ "giver": ayu.id(), "receiver": budi.id() }))
        .await?
        .json()?;
    assert_eq!(back["remaining"], "2000000");
    assert_eq!(env.balance(env.amplop.id().as_str()).await?, 0);
    Ok(())
}

#[tokio::test]
async fn host_not_registered_leaves_the_ledger_untouched() -> TestResult<()> {
    let env = setup().await?;
    let eko = env.user("eko").await?; // never registered on tUSDC
    let budi = env.funded_user("budi").await?;
    let h = env.create_hajat(&eko, 12 * HOUR_MS).await?;
    let t = env.invite(&eko, h, &budi).await?;
    env.seal(&budi, t, 5 * UNIT, None).await?;
    assert!(
        env.check_in(&eko, t).await?.is_success(),
        "the call succeeds, only the inner transfer fails"
    );
    assert_eq!(env.invitation(t).await?["state"], "Sealed");
    assert!(
        owes(&env.ledger(&eko).await?, "i_owe").is_empty(),
        "no claim without moved money"
    );
    assert!(owes(&env.ledger(&budi).await?, "owed_to_me").is_empty());
    Ok(())
}
