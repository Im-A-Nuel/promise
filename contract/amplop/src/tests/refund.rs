//! Phase 3 unit tests: cancel, refund, soulbound, NEP-171 views
//! (T-28, T-29 partly, T-31 to T-36). The sandbox tests move real tokens.

use super::escrow::*;
use super::*;
use near_sdk::{Gas, PromiseResult};

fn gas100() -> Gas {
    Gas::from_tgas(100)
}

/// Seals 5 tUSDC, then runs the host check-in and its successful callback: token is `Opened`.
fn open_token(c: &mut Contract, host: &str, token: u64) {
    seal(c, token, FIVE);
    testing_env!(ctx_at(host, NOW_MS, 0, gas150()).build());
    let _ = c.open(token);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(c.on_open_resolved(token, U128(FIVE)));
}

fn cancel(c: &mut Contract, host: &str, hajat: u64) {
    testing_env!(ctx_at(host, NOW_MS, 0, gas100()).build());
    c.cancel_hajat(hajat);
}

fn refund(c: &mut Contract, caller: &str, now_ms: u64, token: u64) {
    testing_env!(ctx_at(caller, now_ms, 0, gas100()).build());
    let _ = c.refund(token);
}

// ---------------------------------------------------------------- cancel

// T-32 (unit half)
#[test]
fn t32_cancel_with_only_sealed_tokens() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    assert_eq!(c.get_hajat(h).unwrap().status, HajatStatus::Cancelled);
    assert_eq!(c.get_invitation(t).unwrap().card_status, CardStatus::Sealed);
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"hajat_cancelled""#)));
}

#[test]
fn cancelled_hajat_voids_unsealed_invitations() {
    let (mut c, h, t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", h);
    assert_eq!(c.get_invitation(t).unwrap().card_status, CardStatus::Void);
}

// T-33
#[test]
#[should_panic(expected = "ERR_HAS_OPENED")]
fn t33_cancel_after_one_opened() {
    let (mut c, h, t) = setup_open_window();
    open_token(&mut c, "ayu.testnet", t);
    cancel(&mut c, "ayu.testnet", h);
}

#[test]
#[should_panic(expected = "ERR_HAS_OPENED")]
fn cancel_while_a_token_is_opening() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
    cancel(&mut c, "ayu.testnet", h);
}

#[test]
#[should_panic(expected = "ERR_NOT_HOST")]
fn cancel_by_non_host() {
    let (mut c, h, _t) = setup_open_window();
    cancel(&mut c, "budi.testnet", h);
}

#[test]
#[should_panic(expected = "ERR_HAJAT_NOT_OPEN")]
fn cancel_twice() {
    let (mut c, h, _t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", h);
    cancel(&mut c, "ayu.testnet", h);
}

#[test]
#[should_panic(expected = "ERR_HAJAT_NOT_FOUND")]
fn cancel_unknown_hajat() {
    let (mut c, _h, _t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", 99);
}

#[test]
fn after_cancel_seals_are_returned_and_no_new_invites() {
    let (mut c, h, t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", h);
    assert_eq!(seal(&mut c, t, FIVE), FIVE);
}

#[test]
#[should_panic(expected = "ERR_HAJAT_NOT_OPEN")]
fn invite_after_cancel() {
    let (mut c, h, _t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", h);
    testing_env!(ctx("ayu.testnet", 50).build());
    c.invite(h, acct("citra.testnet"), "Citra".into());
}

#[test]
#[should_panic(expected = "ERR_HAJAT_NOT_OPEN")]
fn host_cannot_pull_sealed_money_after_cancel() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
}

// ---------------------------------------------------------------- refund

#[test]
fn t32_refund_after_cancel_then_callback() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);

    // a stranger triggers it
    refund(&mut c, "citra.testnet", NOW_MS, t);
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Refunding);
    assert_eq!(v.sealed, U128(FIVE), "recorded until the callback");
    assert_eq!(near_sdk::test_utils::get_created_receipts().len(), 2);

    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(c.on_refund_resolved(t, U128(FIVE)));
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Refunded);
    assert_eq!(v.card_status, CardStatus::Refunded);
    assert_eq!(v.sealed, U128(0));
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(0));
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"refunded""#)));
}

// T-34
#[test]
#[should_panic(expected = "ERR_NOT_REFUNDABLE")]
fn t34_refund_when_open_and_not_abandoned() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    refund(&mut c, "budi.testnet", NOW_MS, t);
}

// T-35
#[test]
fn t35_refund_after_30_days_still_sealed() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    let event_at = NOW_MS + HOURS_12_MS;
    refund(&mut c, "citra.testnet", event_at + ABANDON_MS, t);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Refunding);
}

#[test]
#[should_panic(expected = "ERR_NOT_REFUNDABLE")]
fn refund_one_ms_before_the_abandon_deadline() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    let event_at = NOW_MS + HOURS_12_MS;
    refund(&mut c, "citra.testnet", event_at + ABANDON_MS - 1, t);
}

// T-36
#[test]
fn t36_refund_callback_failure_returns_to_sealed() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    refund(&mut c, "citra.testnet", NOW_MS, t);

    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Failed,
    );
    assert!(!c.on_refund_resolved(t, U128(FIVE)));
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Sealed);
    assert_eq!(v.sealed, U128(FIVE));
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(FIVE));
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"refund_failed""#)));

    // can be retried
    refund(&mut c, "citra.testnet", NOW_MS + 1, t);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Refunding);
}

#[test]
#[should_panic(expected = "ERR_NOT_REFUNDABLE")]
fn refund_an_unsealed_invitation() {
    let (mut c, h, t) = setup_open_window();
    cancel(&mut c, "ayu.testnet", h);
    refund(&mut c, "budi.testnet", NOW_MS, t);
}

#[test]
#[should_panic(expected = "ERR_NOT_REFUNDABLE")]
fn refund_twice_while_refunding() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    refund(&mut c, "budi.testnet", NOW_MS, t);
    refund(&mut c, "budi.testnet", NOW_MS, t);
}

#[test]
#[should_panic(expected = "ERR_NOT_REFUNDABLE")]
fn refund_an_opened_token() {
    let (mut c, _h, t) = setup_open_window();
    open_token(&mut c, "ayu.testnet", t);
    let event_at = NOW_MS + HOURS_12_MS;
    refund(&mut c, "budi.testnet", event_at + ABANDON_MS, t);
}

#[test]
#[should_panic(expected = "ERR_GAS")]
fn refund_with_low_gas() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    testing_env!(ctx_at("budi.testnet", NOW_MS, 0, Gas::from_tgas(79)).build());
    let _ = c.refund(t);
}

#[test]
fn refund_gas_floor_is_inclusive() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    cancel(&mut c, "ayu.testnet", h);
    testing_env!(ctx_at("budi.testnet", NOW_MS, 0, MIN_GAS_REFUND).build());
    let _ = c.refund(t);
}

#[test]
fn top_up_during_refunding_is_returned() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    refund_after_cancel(&mut c, h, t);
    assert_eq!(seal(&mut c, t, FIVE), FIVE);
}

fn refund_after_cancel(c: &mut Contract, h: u64, t: u64) {
    cancel(c, "ayu.testnet", h);
    refund(c, "citra.testnet", NOW_MS, t);
}

// ---------------------------------------------------------------- NEP-171

// T-28
#[test]
#[should_panic(expected = "ERR_SOULBOUND")]
fn t28_nft_transfer_always_fails() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx("budi.testnet", 0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.nft_transfer(acct("citra.testnet"), t.to_string(), None, None);
}

#[test]
#[should_panic(expected = "ERR_SOULBOUND")]
fn t28_nft_transfer_call_always_fails() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx("budi.testnet", 0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    let _ = c.nft_transfer_call(
        acct("citra.testnet"),
        t.to_string(),
        None,
        None,
        "{}".into(),
    );
}

#[test]
fn nft_token_metadata_hides_the_amount_while_sealed() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    let tok = c.nft_token(t.to_string()).unwrap();
    assert_eq!(tok.token_id, "1");
    assert_eq!(tok.owner_id, acct("budi.testnet"));
    assert_eq!(tok.metadata.title, "Invitation #1: Pernikahan");
    assert_eq!(tok.metadata.description, "Sealed. Opens at the event.");
    assert_eq!(
        tok.metadata.reference.as_deref(),
        Some("https://promise.example/api/nft/1")
    );
    let extra = tok.metadata.extra.unwrap();
    assert!(extra.contains(r#""status":"Sealed""#), "{extra}");
    assert!(extra.contains(&format!(r#""hajat_id":{h}"#)), "{extra}");
    assert!(
        !extra.contains("5000000"),
        "amount must stay hidden: {extra}"
    );
    assert!(tok.approved_account_ids.is_none());
}

#[test]
fn nft_token_unknown_or_malformed_id() {
    let (c, _h, _t) = setup_open_window();
    assert!(c.nft_token("999".into()).is_none());
    assert!(c.nft_token("abc".into()).is_none());
    assert!(c.nft_token("".into()).is_none());
}

#[test]
fn nft_token_shows_the_amount_once_opened() {
    let (mut c, _h, t) = setup_open_window();
    open_token(&mut c, "ayu.testnet", t);
    let tok = c.nft_token(t.to_string()).unwrap();
    assert_eq!(tok.metadata.description, "Opened. Waiting for its answer.");
    assert!(tok
        .metadata
        .extra
        .unwrap()
        .contains(r#""released":"5000000""#));
}

// T-31
#[test]
fn t31_tokens_for_owner_pagination_and_cap() {
    let mut c = fresh();
    // budi is a guest at 60 different hajats
    for i in 0..60 {
        let host = format!("host{i}.testnet");
        let h = create(&mut c, &host, JoinPolicy::InviteOnly);
        invite(&mut c, &host, h, "budi.testnet");
    }
    let budi = acct("budi.testnet");
    assert_eq!(c.nft_supply_for_owner(budi.clone()), U128(60));
    assert_eq!(c.nft_total_supply(), U128(60));

    let ids = |v: Vec<crate::nft::JsonToken>| -> Vec<String> {
        v.into_iter().map(|t| t.token_id).collect()
    };
    assert_eq!(
        ids(c.nft_tokens_for_owner(budi.clone(), Some(U128(2)), Some(3))),
        vec!["3", "4", "5"]
    );
    assert_eq!(c.nft_tokens_for_owner(budi.clone(), None, None).len(), 50);
    assert_eq!(
        c.nft_tokens_for_owner(budi.clone(), None, Some(500)).len(),
        50
    );
    assert_eq!(
        c.nft_tokens_for_owner(budi.clone(), Some(U128(55)), None)
            .len(),
        5
    );
    assert!(c
        .nft_tokens_for_owner(budi, Some(U128(60)), None)
        .is_empty());
    assert!(c
        .nft_tokens_for_owner(acct("nobody.testnet"), None, None)
        .is_empty());
    assert_eq!(c.nft_supply_for_owner(acct("nobody.testnet")), U128(0));

    assert_eq!(c.nft_tokens(None, None).len(), 50);
    assert_eq!(c.nft_tokens(Some(U128(58)), Some(10)).len(), 2);
}

#[test]
fn nft_contract_metadata() {
    let c = fresh();
    let m = c.nft_metadata();
    assert_eq!(m.spec, "nft-1.0.0");
    assert_eq!(m.symbol, "AMPLOP");
}
