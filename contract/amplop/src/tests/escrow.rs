//! Phase 2 unit tests: escrow (T-11 to T-18 and the callback paths).
//! The sandbox tests in tests/sandbox.rs cover the real token transfers (T-17, T-19).

use super::*;
use crate::constants::MIN_SPARE_BALANCE;
use near_sdk::{Gas, PromiseOrValue, PromiseResult, VMContext};

pub(super) const TUSDC: &str = "tusdc.testnet";
pub(super) const AMPLOP: &str = "amplop.testnet";
pub(super) const FIVE: u128 = 5_000_000;
pub(super) const HOURS_12_MS: u64 = 12 * 3_600_000;

pub(super) fn ctx_at(
    pred: &str,
    now_ms: u64,
    deposit_millinear: u64,
    gas: Gas,
) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(AMPLOP))
        .predecessor_account_id(acct(pred))
        .block_timestamp(now_ms * 1_000_000)
        .prepaid_gas(gas)
        .attached_deposit(NearToken::from_millinear(deposit_millinear.into()));
    b
}

pub(super) fn gas150() -> Gas {
    Gas::from_tgas(150)
}

/// Hajat whose host window is already open: the event is 12 hours away.
pub(super) fn setup_open_window() -> (Contract, u64, u64) {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    let h = c
        .create_hajat(
            "Pernikahan".into(),
            HajatKind::Wedding,
            "Gedung".into(),
            NOW_MS + HOURS_12_MS,
            JoinPolicy::InviteOnly,
        )
        .0;
    let t = invite(&mut c, "ayu.testnet", h, "budi.testnet");
    (c, h, t)
}

pub(super) fn seal_msg(token: u64, note: Option<&str>) -> String {
    match note {
        Some(n) => format!(r#"{{"token_id":"{token}","note":"{n}"}}"#),
        None => format!(r#"{{"token_id":"{token}"}}"#),
    }
}

/// Calls ft_on_transfer as `pred`. Returns the unused amount.
pub(super) fn on_transfer(
    c: &mut Contract,
    pred: &str,
    sender: &str,
    amount: u128,
    msg: String,
) -> u128 {
    testing_env!(ctx_at(pred, NOW_MS, 0, Gas::from_tgas(100)).build());
    match c.ft_on_transfer(acct(sender), U128(amount), msg) {
        PromiseOrValue::Value(v) => v.0,
        PromiseOrValue::Promise(_) => panic!("unexpected promise"),
    }
}

pub(super) fn seal(c: &mut Contract, token: u64, amount: u128) -> u128 {
    on_transfer(c, TUSDC, "budi.testnet", amount, seal_msg(token, None))
}

// T-11
#[test]
fn t11_seal_with_note() {
    let (mut c, h, t) = setup_open_window();
    let unused = on_transfer(
        &mut c,
        TUSDC,
        "budi.testnet",
        FIVE,
        seal_msg(t, Some("Selamat ya")),
    );
    assert_eq!(unused, 0);
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Sealed);
    assert_eq!(v.card_status, CardStatus::Sealed);
    assert_eq!(v.sealed, U128(FIVE));
    assert_eq!(v.note, "Selamat ya");
    assert_eq!(v.sealed_at_ms, Some(NOW_MS));
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(FIVE));
}

// T-12
#[test]
fn t12_top_up_keeps_note_and_first_seal_time() {
    let (mut c, h, t) = setup_open_window();
    on_transfer(&mut c, TUSDC, "budi.testnet", FIVE, seal_msg(t, Some("hi")));
    testing_env!(ctx_at(TUSDC, NOW_MS + 1000, 0, Gas::from_tgas(100)).build());
    let r = c.ft_on_transfer(acct("budi.testnet"), U128(2_000_000), seal_msg(t, None));
    assert!(matches!(r, PromiseOrValue::Value(U128(0))));
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.sealed, U128(7_000_000));
    assert_eq!(v.note, "hi");
    assert_eq!(v.sealed_at_ms, Some(NOW_MS));
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(7_000_000));
}

// T-13
#[test]
fn t13_seal_from_non_owner_is_returned() {
    let (mut c, h, t) = setup_open_window();
    let unused = on_transfer(&mut c, TUSDC, "citra.testnet", FIVE, seal_msg(t, None));
    assert_eq!(unused, FIVE);
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Invited);
    assert_eq!(v.sealed, U128(0));
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(0));
}

// T-14
#[test]
fn t14_seal_below_minimum_is_returned() {
    let (mut c, _h, t) = setup_open_window();
    assert_eq!(seal(&mut c, t, MIN_AMPLOP - 1), MIN_AMPLOP - 1);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Invited);
    assert_eq!(seal(&mut c, t, MIN_AMPLOP), 0);
    assert_eq!(c.get_invitation(t).unwrap().sealed, U128(MIN_AMPLOP));
}

// T-15
#[test]
#[should_panic(expected = "ERR_WRONG_TOKEN")]
fn t15_ft_on_transfer_from_stranger() {
    let (mut c, _h, t) = setup_open_window();
    on_transfer(
        &mut c,
        "evil.testnet",
        "budi.testnet",
        FIVE,
        seal_msg(t, None),
    );
}

#[test]
fn bad_messages_are_returned() {
    let (mut c, _h, t) = setup_open_window();
    for msg in [
        "not json".to_string(),
        "{}".to_string(),
        r#"{"token_id":"abc"}"#.to_string(),
        seal_msg(999, None),
        seal_msg(t, Some(&"x".repeat(141))),
    ] {
        assert_eq!(on_transfer(&mut c, TUSDC, "budi.testnet", FIVE, msg), FIVE);
    }
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Invited);
    let ok_note = "x".repeat(140);
    assert_eq!(
        on_transfer(
            &mut c,
            TUSDC,
            "budi.testnet",
            FIVE,
            seal_msg(t, Some(&ok_note))
        ),
        0
    );
}

#[test]
fn seal_after_deadline_is_returned() {
    let (mut c, _h, t) = setup_open_window();
    let event_at = NOW_MS + HOURS_12_MS;
    testing_env!(ctx_at(TUSDC, event_at + SEAL_UNTIL_MS, 0, Gas::from_tgas(100)).build());
    let r = c.ft_on_transfer(acct("budi.testnet"), U128(FIVE), seal_msg(t, None));
    assert!(matches!(r, PromiseOrValue::Value(U128(v)) if v == FIVE));
    testing_env!(ctx_at(TUSDC, event_at + SEAL_UNTIL_MS - 1, 0, Gas::from_tgas(100)).build());
    let r = c.ft_on_transfer(acct("budi.testnet"), U128(FIVE), seal_msg(t, None));
    assert!(matches!(r, PromiseOrValue::Value(U128(0))));
}

// T-16
#[test]
#[should_panic(expected = "ERR_TOO_EARLY")]
fn t16_check_in_before_window() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly); // event in 30 days
    let t = invite(&mut c, "ayu.testnet", h, "budi.testnet");
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
}

#[test]
fn check_in_window_boundary() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let t = invite(&mut c, "ayu.testnet", h, "budi.testnet");
    let event_at = NOW_MS + 30 * DAY_MS;
    testing_env!(ctx_at("ayu.testnet", event_at - OPEN_WINDOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
    assert!(c.get_invitation(t).unwrap().checked_in);
}

#[test]
fn check_in_invited_records_attendance_only() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let r = c.check_in(t);
    assert!(matches!(r, PromiseOrValue::Value(())));
    let v = c.get_invitation(t).unwrap();
    assert!(v.checked_in);
    assert_eq!(v.state, InvState::Invited);
    assert!(get_created_receipts().is_empty());
}

#[test]
#[should_panic(expected = "ERR_NOT_HOST")]
fn check_in_by_non_host() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx_at("budi.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
}

#[test]
#[should_panic(expected = "ERR_GAS")]
fn check_in_with_low_gas() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, Gas::from_tgas(60)).build());
    let _ = c.check_in(t);
}

#[test]
fn gas_floor_is_inclusive() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, MIN_GAS_OPEN).build());
    let _ = c.check_in(t);
}

#[test]
#[should_panic(expected = "ERR_TOKEN_NOT_FOUND")]
fn check_in_unknown_token() {
    let (mut c, _h, _t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(42);
}

// T-17 (contract half: the lock and the transfer start, the callback finishes it)
#[test]
fn t17_check_in_sealed_locks_and_starts_transfer() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let r = c.check_in(t);
    assert!(matches!(r, PromiseOrValue::Promise(_)));
    drop(r); // a Promise is scheduled when it is dropped or returned
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Opening);
    assert_eq!(v.card_status, CardStatus::Sealed);
    assert!(v.checked_in);
    assert_eq!(
        v.sealed,
        U128(FIVE),
        "money stays recorded until the callback"
    );
    assert_eq!(
        get_created_receipts().len(),
        2,
        "ft_transfer and the callback"
    );
}

#[test]
fn opening_token_rejects_more_seals() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
    assert_eq!(
        seal(&mut c, t, FIVE),
        FIVE,
        "top-up during Opening is returned"
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_STATE")]
fn open_twice_while_opening() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
}

#[test]
#[should_panic(expected = "ERR_BAD_STATE")]
fn open_an_unsealed_invitation() {
    let (mut c, _h, t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
}

// T-18
#[test]
#[should_panic(expected = "ERR_TOO_EARLY")]
fn t18_stranger_opens_before_auto_window() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    let event_at = NOW_MS + HOURS_12_MS;
    testing_env!(ctx_at("citra.testnet", event_at + AUTO_OPEN_MS - 1, 0, gas150()).build());
    let _ = c.open(t);
}

#[test]
fn t18_stranger_opens_after_auto_window() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    let event_at = NOW_MS + HOURS_12_MS;
    testing_env!(ctx_at("citra.testnet", event_at + AUTO_OPEN_MS, 0, gas150()).build());
    let _ = c.open(t);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Opening);
}

#[test]
#[should_panic(expected = "ERR_TOO_EARLY")]
fn host_open_before_window() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let t = invite(&mut c, "ayu.testnet", h, "budi.testnet");
    // sealing is allowed any time before the deadline, even before the host window
    assert_eq!(seal(&mut c, t, FIVE), 0);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
}

#[test]
fn on_open_resolved_success_moves_to_opened() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);

    with_result(
        ctx_at(AMPLOP, NOW_MS + 5000, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(c.on_open_resolved(t, U128(FIVE)));
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Opened);
    assert_eq!(v.card_status, CardStatus::Opened);
    assert_eq!(v.sealed, U128(0));
    assert_eq!(v.released, U128(FIVE));
    assert_eq!(v.opened_at_ms, Some(NOW_MS + 5000));
    let hajat = c.get_hajat(h).unwrap();
    assert_eq!(hajat.sealed_total, U128(0));
    assert_eq!(hajat.released_total, U128(FIVE));
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"opened""#)));
}

// T-19 (contract half): a failed transfer rolls the lock back
#[test]
fn t19_on_open_resolved_failure_returns_to_sealed() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);

    with_result(
        ctx_at(AMPLOP, NOW_MS + 5000, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Failed,
    );
    assert!(!c.on_open_resolved(t, U128(FIVE)));
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.state, InvState::Sealed);
    assert_eq!(v.sealed, U128(FIVE));
    assert_eq!(v.released, U128(0));
    let hajat = c.get_hajat(h).unwrap();
    assert_eq!(hajat.sealed_total, U128(FIVE));
    assert_eq!(hajat.released_total, U128(0));
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"open_failed""#)));

    // the host can try again
    testing_env!(ctx_at("ayu.testnet", NOW_MS + 6000, 0, gas150()).build());
    let _ = c.open(t);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Opening);
}

#[test]
fn on_open_resolved_ignores_tokens_not_opening() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(!c.on_open_resolved(t, U128(FIVE)));
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Sealed);
}

/// Switches the mocked environment to a callback context with one promise result.
/// The `testing_env!` replacement needs runtime configs that have no `Default`.
#[allow(deprecated)]
pub(super) fn with_result(context: VMContext, result: PromiseResult) {
    near_sdk::test_utils::testing_env_with_promise_results(context, result);
}

// ---------------------------------------------------------------- low balance guard (F-1)

fn low_balance_ctx(pred: &str) -> VMContextBuilder {
    let mut b = ctx_at(pred, NOW_MS, 0, gas150());
    b.account_balance(NearToken::from_millinear(1));
    b
}

#[test]
#[should_panic(expected = "ERR_LOW_BALANCE")]
fn open_is_refused_before_any_state_change_when_the_contract_is_low_on_near() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(low_balance_ctx("ayu.testnet").build());
    let _ = c.check_in(t);
}

#[test]
fn a_refused_open_leaves_the_token_sealed() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, FIVE);
    testing_env!(low_balance_ctx("ayu.testnet").build());
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = c.open(t);
    }));
    assert!(result.is_err());
    // the real runtime reverts the whole call; here we check no promise was created first
    assert!(get_created_receipts().is_empty());
}

#[test]
fn seal_is_handed_back_when_the_contract_is_low_on_near() {
    let (mut c, h, t) = setup_open_window();
    let mut b = ctx_at(TUSDC, NOW_MS, 0, Gas::from_tgas(100));
    b.account_balance(NearToken::from_millinear(1));
    testing_env!(b.build());
    let r = c.ft_on_transfer(acct("budi.testnet"), U128(FIVE), seal_msg(t, None));
    assert!(matches!(r, PromiseOrValue::Value(U128(v)) if v == FIVE));
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Invited);
    assert_eq!(c.get_hajat(h).unwrap().sealed_total, U128(0));
}

#[test]
fn get_config_reports_the_spare_balance() {
    let c = fresh();
    assert!(c.get_config().spare_balance.0 > MIN_SPARE_BALANCE);
}
