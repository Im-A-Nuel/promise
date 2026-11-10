//! The activity log (docs/CONTRACTS.md section 8): what is recorded, in what order, paging, filtering, the cap.

use super::escrow::*;
use super::ledger::{gift, hajat_of, name};
use super::*;
use crate::activity::{ActivityEntry, ActivityKind};
use crate::constants::{MAX_ACTIVITY, MAX_ACTIVITY_SCAN};
use near_sdk::json_types::U64;
use near_sdk::{Gas, PromiseResult};

const UNIT: u128 = 1_000_000;

fn all(c: &Contract) -> Vec<ActivityEntry> {
    c.get_activity(Some(0), Some(50))
}

fn kinds(entries: &[ActivityEntry]) -> Vec<ActivityKind> {
    entries.iter().map(|e| e.kind).collect()
}

#[test]
fn an_empty_contract_has_an_empty_log() {
    let c = fresh();
    assert_eq!(c.get_config().activity_count, 0);
    assert!(c.get_activity(None, None).is_empty());
    assert!(c.get_recent_activity(None, None, None).is_empty());
}

#[test]
fn creating_and_inviting_are_logged_with_the_host_as_actor() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    testing_env!(ctx("ayu.testnet", 100).build());
    let items = vec![
        InviteItem {
            guest: acct(&name("budi")),
            label: "Budi".into(),
        },
        InviteItem {
            guest: acct(&name("citra")),
            label: "Citra".into(),
        },
    ];
    let ids = c.invite_many(h, items);

    let log = all(&c);
    assert_eq!(
        kinds(&log),
        vec![
            ActivityKind::HajatCreated,
            ActivityKind::Invited,
            ActivityKind::Invited
        ]
    );
    assert_eq!(log[0].hajat_id, h);
    assert_eq!(log[0].token_id, 0);
    assert_eq!(log[1].token_id, ids[0].0);
    assert_eq!(log[2].token_id, ids[1].0);
    assert!(log.iter().all(|e| e.actor == acct(&name("ayu"))));
    assert_eq!(c.get_config().activity_count, 3);
}

#[test]
fn indexes_are_contiguous_and_times_do_not_go_back() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    gift(&mut c, h, "budi", 5 * UNIT);
    let log = all(&c);
    assert_eq!(log.len(), 4, "created, invited, sealed, opened");
    for (i, e) in log.iter().enumerate() {
        assert_eq!(e.idx as usize, i);
    }
    assert!(log.windows(2).all(|w| w[0].at_ms <= w[1].at_ms));
}

#[test]
fn a_full_gift_is_logged_step_by_step() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    let token = gift(&mut c, h, "budi", 5 * UNIT);

    let mine: Vec<ActivityEntry> = all(&c)
        .into_iter()
        .filter(|e| e.token_id == token)
        .collect();
    assert_eq!(
        kinds(&mine),
        vec![
            ActivityKind::Invited,
            ActivityKind::Sealed,
            ActivityKind::Opened
        ]
    );
    // the guest acts when sealing, the host acts when opening
    assert_eq!(mine[1].actor, acct(&name("budi")));
    assert_eq!(mine[1].amount, U128(5 * UNIT));
    assert_eq!(mine[2].actor, acct(&name("ayu")));
    assert_eq!(mine[2].amount, U128(5 * UNIT));
}

#[test]
fn check_in_is_logged_even_when_nothing_moves() {
    let (mut c, h, t) = setup_open_window();
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
    let last = c.get_recent_activity(None, Some(U64(t)), Some(1));
    assert_eq!(last[0].kind, ActivityKind::CheckedIn);
    assert_eq!(last[0].hajat_id, h);
    assert_eq!(last[0].actor, acct("ayu.testnet"));
}

#[test]
fn a_repayment_is_logged_against_the_older_token() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let old = gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h2, "ayu", 5 * UNIT);

    let repaid: Vec<ActivityEntry> = all(&c)
        .into_iter()
        .filter(|e| e.kind == ActivityKind::Repaid)
        .collect();
    assert_eq!(repaid.len(), 1);
    assert_eq!(
        repaid[0].token_id, old,
        "the card that flips is the older one"
    );
    assert_eq!(repaid[0].amount, U128(5 * UNIT));
    assert_eq!(repaid[0].actor, acct(&name("ayu")), "the payer");
    assert_ne!(repaid[0].token_id, reply);

    // so the old token's history ends with its repayment
    let history = c.get_recent_activity(None, Some(U64(old)), None);
    assert_eq!(history[0].kind, ActivityKind::Repaid);
}

#[test]
fn cancel_and_refund_are_logged() {
    let (mut c, h, t) = setup_open_window();
    seal(&mut c, t, 5 * UNIT);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, Gas::from_tgas(100)).build());
    c.cancel_hajat(h);
    testing_env!(ctx_at("citra.testnet", NOW_MS, 0, Gas::from_tgas(100)).build());
    let _ = c.refund(t);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(c.on_refund_resolved(t, U128(5 * UNIT)));

    let log = all(&c);
    assert!(kinds(&log).contains(&ActivityKind::HajatCancelled));
    let refunded = log
        .iter()
        .find(|e| e.kind == ActivityKind::Refunded)
        .unwrap();
    assert_eq!(refunded.token_id, t);
    assert_eq!(
        refunded.actor,
        acct("budi.testnet"),
        "the owner, not the caller"
    );
    assert_eq!(refunded.amount, U128(5 * UNIT));
}

#[test]
fn failed_transfers_are_logged_too() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, 5 * UNIT);
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.check_in(t);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(30)).build(),
        PromiseResult::Failed,
    );
    assert!(!c.on_open_resolved(t, U128(5 * UNIT)));
    let last = c.get_recent_activity(None, Some(U64(t)), Some(1));
    assert_eq!(last[0].kind, ActivityKind::OpenFailed);
    assert_eq!(last[0].amount, U128(5 * UNIT));
}

#[test]
fn join_is_logged_with_the_guest_as_actor() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    let h = c
        .create_hajat(
            "Open".into(),
            HajatKind::Other,
            "".into(),
            NOW_MS + 100_000,
            JoinPolicy::OpenLink,
        )
        .0;
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi".into());
    let last = c.get_recent_activity(Some(U64(h)), None, Some(1));
    assert_eq!(last[0].kind, ActivityKind::Joined);
    assert_eq!(last[0].actor, acct("dewi.testnet"));
}

#[test]
fn get_activity_pages_in_order_and_caps_the_limit() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    // one hajat entry plus three entries per gift: 21 gifts make 64 entries, more than one page
    for i in 0..21 {
        gift(&mut c, h, &format!("g{i}"), UNIT);
    }
    let total = c.get_config().activity_count;
    assert!(total > 50);
    assert_eq!(
        c.get_activity(None, None).len(),
        50,
        "default page is capped at 50"
    );
    assert_eq!(c.get_activity(Some(0), Some(500)).len(), 50);
    let page = c.get_activity(Some(10), Some(3));
    assert_eq!(
        page.iter().map(|e| e.idx).collect::<Vec<_>>(),
        vec![10, 11, 12]
    );
    assert_eq!(c.get_activity(Some(total - 1), Some(10)).len(), 1);
    assert!(c.get_activity(Some(total), None).is_empty());
    assert!(c.get_activity(Some(u32::MAX), Some(50)).is_empty());
}

#[test]
fn recent_activity_is_newest_first_and_can_be_filtered() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let t1 = gift(&mut c, h1, "budi", UNIT);
    let h2 = hajat_of(&mut c, "budi");
    gift(&mut c, h2, "citra", 2 * UNIT);

    let newest = c.get_recent_activity(None, None, Some(50));
    assert!(
        newest.windows(2).all(|w| w[0].idx > w[1].idx),
        "strictly newest first"
    );
    assert_eq!(newest.len() as u32, c.get_config().activity_count);

    let only_h1 = c.get_recent_activity(Some(U64(h1)), None, None);
    assert!(only_h1.iter().all(|e| e.hajat_id == h1));
    assert!(only_h1
        .iter()
        .any(|e| e.hajat_id == h1 && e.kind == ActivityKind::HajatCreated));

    let only_t1 = c.get_recent_activity(None, Some(U64(t1)), None);
    assert_eq!(
        kinds(&only_t1),
        vec![
            ActivityKind::Opened,
            ActivityKind::Sealed,
            ActivityKind::Invited
        ]
    );

    let both = c.get_recent_activity(Some(U64(h1)), Some(U64(t1)), Some(1));
    assert_eq!(both.len(), 1);
    assert_eq!(both[0].kind, ActivityKind::Opened);
    assert!(c.get_recent_activity(Some(U64(999)), None, None).is_empty());
}

#[test]
fn the_json_shape_matches_the_spec() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    gift(&mut c, h, "budi", 5 * UNIT);
    let entry = c.get_recent_activity(None, None, Some(1)).remove(0);
    let json = near_sdk::serde_json::to_value(&entry).unwrap();
    assert_eq!(
        json["kind"], "opened",
        "snake_case names, as in the NEP-297 events"
    );
    assert_eq!(json["amount"], "5000000", "amounts are decimal strings");
    assert!(
        json["at_ms"].is_u64()
            && json["idx"].is_u64()
            && json["hajat_id"].is_u64()
            && json["token_id"].is_u64()
    );
    assert_eq!(json["actor"], name("ayu"));
}

#[test]
fn the_log_stops_at_the_cap_and_everything_else_keeps_working() {
    let mut c = fresh();
    let host = acct("ayu.testnet");
    for _ in 0..(MAX_ACTIVITY + 50) {
        c.record(ActivityKind::Invited, 1, 1, &host, 0);
    }
    assert_eq!(c.get_config().activity_count, MAX_ACTIVITY);
    assert_eq!(c.get_activity(Some(MAX_ACTIVITY - 1), Some(50)).len(), 1);
    // a real call ends by writing state, which flushes these entries; here we do it by hand
    c.flush_all();

    // a full log must never break money: seal, open and settle still work and record nothing new
    let h = hajat_of(&mut c, "ayu");
    let t = gift(&mut c, h, "budi", 5 * UNIT);
    assert_eq!(c.get_invitation(t).unwrap().state, InvState::Opened);
    assert_eq!(c.get_config().activity_count, MAX_ACTIVITY);
}

#[test]
fn recent_activity_only_looks_back_a_bounded_distance() {
    let mut c = fresh();
    let host = acct("ayu.testnet");
    // one old entry for token 7, then more than the scan window of other entries
    c.record(ActivityKind::Sealed, 1, 7, &host, UNIT);
    for _ in 0..(MAX_ACTIVITY_SCAN + 10) {
        c.record(ActivityKind::Invited, 1, 1, &host, 0);
    }
    assert!(
        c.get_recent_activity(None, Some(U64(7)), None).is_empty(),
        "too old to be reached"
    );
    assert_eq!(
        c.get_recent_activity(None, Some(U64(1)), Some(50)).len(),
        50
    );
}
