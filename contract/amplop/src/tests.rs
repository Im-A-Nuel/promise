//! Unit tests for Phase 1: T-01 to T-10 and T-39 (docs/CONTRACTS.md section 12).

use crate::constants::*;
use crate::types::*;
use crate::Contract;
use near_sdk::json_types::U128;
use near_sdk::test_utils::{get_created_receipts, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};

const NOW_MS: u64 = 1_800_000_000_000;
const DAY_MS: u64 = 86_400_000;

fn acct(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn ctx(predecessor: &str, deposit_millinear: u64) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.predecessor_account_id(acct(predecessor))
        .block_timestamp(NOW_MS * 1_000_000)
        .attached_deposit(NearToken::from_millinear(deposit_millinear.into()));
    b
}

fn fresh() -> Contract {
    testing_env!(ctx("owner.testnet", 0).build());
    Contract::new(
        acct("owner.testnet"),
        acct("tusdc.testnet"),
        "https://promise.example".into(),
    )
}

fn create(c: &mut Contract, host: &str, policy: JoinPolicy) -> u64 {
    testing_env!(ctx(host, 50).build());
    c.create_hajat(
        "Pernikahan Ayu & Bima".into(),
        HajatKind::Wedding,
        "Gedung Serbaguna".into(),
        NOW_MS + 30 * DAY_MS,
        policy,
    )
    .0
}

fn invite(c: &mut Contract, host: &str, hajat: u64, guest: &str) -> u64 {
    testing_env!(ctx(host, 50).build());
    c.invite(hajat, acct(guest), format!("Guest {guest}")).0
}

// T-01
#[test]
fn t01_create_hajat_stores_and_refunds() {
    let mut c = fresh();
    let id = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    assert_eq!(id, 1);
    let h = c.get_hajat(1).unwrap();
    assert_eq!(h.host, acct("ayu.testnet"));
    assert_eq!(h.title, "Pernikahan Ayu & Bima");
    assert_eq!(h.status, HajatStatus::Open);
    assert_eq!(h.invite_count, 0);
    assert_eq!(h.created_at_ms, NOW_MS);
    assert_eq!(c.get_config().hajat_count, 1);
    assert!(
        !get_created_receipts().is_empty(),
        "excess deposit should be refunded"
    );
}

#[test]
fn hajat_ids_increase_and_list_newest_first() {
    let mut c = fresh();
    create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    create(&mut c, "budi.testnet", JoinPolicy::OpenLink);
    create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let all: Vec<u64> = c.get_hajats(None, None).iter().map(|h| h.id).collect();
    assert_eq!(all, vec![3, 2, 1]);
    let ayu: Vec<u64> = c
        .get_hajats_by_host(acct("ayu.testnet"), None, None)
        .iter()
        .map(|h| h.id)
        .collect();
    assert_eq!(ayu, vec![3, 1]);
    let page: Vec<u64> = c
        .get_hajats(Some(1), Some(1))
        .iter()
        .map(|h| h.id)
        .collect();
    assert_eq!(page, vec![2]);
    assert!(c.get_hajats(Some(10), None).is_empty());
}

// T-02
#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn t02_empty_title() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn t02_blank_title() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "   ".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn t02_title_over_80() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "x".repeat(81),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
}

#[test]
fn t02_title_exactly_80_is_ok() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "x".repeat(80),
        HajatKind::Other,
        "".into(),
        NOW_MS,
        JoinPolicy::InviteOnly,
    );
    assert!(c.get_hajat(1).is_some());
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn t02_venue_over_80() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "t".into(),
        HajatKind::Wedding,
        "v".repeat(81),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
}

// T-03
#[test]
#[should_panic(expected = "ERR_BAD_TIME")]
fn t03_event_in_the_past() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "t".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS - 1,
        JoinPolicy::InviteOnly,
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_TIME")]
fn t03_event_over_365_days() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 50).build());
    c.create_hajat(
        "t".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + MAX_EVENT_AHEAD_MS + 1,
        JoinPolicy::InviteOnly,
    );
}

// T-04
#[test]
fn t04_invite_mints_to_guest() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let t = invite(&mut c, "ayu.testnet", h, "budi.testnet");
    assert_eq!(t, 1);
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.owner, acct("budi.testnet"));
    assert_eq!(v.state, InvState::Invited);
    assert_eq!(v.card_status, CardStatus::Invited);
    assert_eq!(v.sealed, U128(0));
    assert_eq!(c.get_hajat(h).unwrap().invite_count, 1);
    assert_eq!(c.get_config().token_count, 1);
    assert_eq!(
        c.get_invitation_for(h, acct("budi.testnet"))
            .unwrap()
            .token_id,
        t
    );
    assert!(c.get_invitation_for(h, acct("citra.testnet")).is_none());
}

// T-05
#[test]
#[should_panic(expected = "ERR_ALREADY_INVITED")]
fn t05_invite_same_guest_twice() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    invite(&mut c, "ayu.testnet", h, "budi.testnet");
    invite(&mut c, "ayu.testnet", h, "budi.testnet");
}

#[test]
fn same_guest_can_be_invited_to_different_hajats() {
    let mut c = fresh();
    let h1 = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let h2 = create(&mut c, "citra.testnet", JoinPolicy::InviteOnly);
    let t1 = invite(&mut c, "ayu.testnet", h1, "budi.testnet");
    let t2 = invite(&mut c, "citra.testnet", h2, "budi.testnet");
    assert_ne!(t1, t2);
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn host_cannot_invite_self() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    invite(&mut c, "ayu.testnet", h, "ayu.testnet");
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn invite_label_empty() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("ayu.testnet", 50).build());
    c.invite(h, acct("budi.testnet"), "".into());
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn invite_label_over_40() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("ayu.testnet", 50).build());
    c.invite(h, acct("budi.testnet"), "x".repeat(41));
}

#[test]
#[should_panic(expected = "ERR_HAJAT_NOT_FOUND")]
fn invite_unknown_hajat() {
    let mut c = fresh();
    invite(&mut c, "ayu.testnet", 99, "budi.testnet");
}

// T-06
#[test]
#[should_panic(expected = "ERR_NOT_HOST")]
fn t06_invite_by_non_host() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    invite(&mut c, "budi.testnet", h, "citra.testnet");
}

// T-07
#[test]
#[should_panic(expected = "ERR_QUOTA_FULL")]
fn t07_201st_invitation() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    for i in 0..=MAX_INVITES {
        invite(&mut c, "ayu.testnet", h, &format!("g{i}.testnet"));
    }
}

#[test]
fn t07_exactly_200_is_ok() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    for i in 0..MAX_INVITES {
        invite(&mut c, "ayu.testnet", h, &format!("g{i}.testnet"));
    }
    assert_eq!(c.get_hajat(h).unwrap().invite_count, MAX_INVITES);
}

// T-08
#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn t08_invite_many_21_items() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let items = (0..21)
        .map(|i| InviteItem {
            guest: acct(&format!("g{i}.testnet")),
            label: format!("G{i}"),
        })
        .collect();
    testing_env!(ctx("ayu.testnet", 500).build());
    c.invite_many(h, items);
}

#[test]
#[should_panic(expected = "ERR_BAD_INPUT")]
fn invite_many_empty() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("ayu.testnet", 50).build());
    c.invite_many(h, vec![]);
}

#[test]
fn invite_many_20_items_mints_all() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let items = (0..20)
        .map(|i| InviteItem {
            guest: acct(&format!("g{i}.testnet")),
            label: format!("G{i}"),
        })
        .collect();
    testing_env!(ctx("ayu.testnet", 500).build());
    let ids = c.invite_many(h, items);
    assert_eq!(ids.len(), 20);
    assert_eq!(c.get_hajat(h).unwrap().invite_count, 20);
    let listed = c.get_invitations(h, None, None);
    assert_eq!(listed.len(), 20);
    assert_eq!(listed[0].label, "G0");
    assert_eq!(listed[19].label, "G19");
}

#[test]
#[should_panic(expected = "ERR_ALREADY_INVITED")]
fn invite_many_duplicate_in_batch() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    let items = vec![
        InviteItem {
            guest: acct("budi.testnet"),
            label: "A".into(),
        },
        InviteItem {
            guest: acct("budi.testnet"),
            label: "B".into(),
        },
    ];
    testing_env!(ctx("ayu.testnet", 100).build());
    c.invite_many(h, items);
}

#[test]
fn get_invitations_pagination() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    for i in 0..5 {
        invite(&mut c, "ayu.testnet", h, &format!("g{i}.testnet"));
    }
    let p: Vec<String> = c
        .get_invitations(h, Some(1), Some(2))
        .into_iter()
        .map(|v| v.label)
        .collect();
    assert_eq!(p, vec!["Guest g1.testnet", "Guest g2.testnet"]);
    assert_eq!(c.get_invitations(h, Some(4), Some(50)).len(), 1);
    assert!(c.get_invitations(h, Some(5), None).is_empty());
    assert!(c.get_invitations(99, None, None).is_empty());
}

// T-09
#[test]
#[should_panic(expected = "ERR_INVITE_ONLY")]
fn t09_join_invite_only() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi".into());
}

// T-10
#[test]
fn t10_join_open_link_once() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::OpenLink);
    testing_env!(ctx("dewi.testnet", 50).build());
    let t = c.join(h, "Dewi".into()).0;
    let v = c.get_invitation(t).unwrap();
    assert_eq!(v.owner, acct("dewi.testnet"));
    assert_eq!(v.label, "Dewi");
}

#[test]
#[should_panic(expected = "ERR_ALREADY_INVITED")]
fn t10_join_twice() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::OpenLink);
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi".into());
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi again".into());
}

#[test]
#[should_panic(expected = "ERR_ALREADY_INVITED")]
fn join_after_being_invited() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::OpenLink);
    invite(&mut c, "ayu.testnet", h, "dewi.testnet");
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi".into());
}

#[test]
fn set_join_policy_by_host_only() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("ayu.testnet", 0).build());
    c.set_join_policy(h, JoinPolicy::OpenLink);
    assert_eq!(c.get_hajat(h).unwrap().join_policy, JoinPolicy::OpenLink);
    testing_env!(ctx("dewi.testnet", 50).build());
    c.join(h, "Dewi".into());
}

#[test]
#[should_panic(expected = "ERR_NOT_HOST")]
fn set_join_policy_by_stranger() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("budi.testnet", 0).build());
    c.set_join_policy(h, JoinPolicy::OpenLink);
}

// T-39
#[test]
#[should_panic(expected = "ERR_DEPOSIT_TOO_LOW")]
fn t39_create_with_no_deposit() {
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 0).build());
    c.create_hajat(
        "t".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
}

#[test]
#[should_panic(expected = "ERR_DEPOSIT_TOO_LOW")]
fn invite_with_no_deposit() {
    let mut c = fresh();
    let h = create(&mut c, "ayu.testnet", JoinPolicy::InviteOnly);
    testing_env!(ctx("ayu.testnet", 0).build());
    c.invite(h, acct("budi.testnet"), "Budi".into());
}

#[test]
fn documented_deposits_are_enough() {
    // docs: 0.02 NEAR for create_hajat, 0.01 NEAR per invitation
    let mut c = fresh();
    testing_env!(ctx("ayu.testnet", 20).build());
    c.create_hajat(
        "t".into(),
        HajatKind::Wedding,
        "v".into(),
        NOW_MS + DAY_MS,
        JoinPolicy::InviteOnly,
    );
    testing_env!(ctx("ayu.testnet", 10).build());
    c.invite(1, acct("budi.testnet"), "Budi".into());
    let items = (0..20)
        .map(|i| InviteItem {
            guest: acct(&format!("g{i}.testnet")),
            label: format!("G{i}"),
        })
        .collect();
    testing_env!(ctx("ayu.testnet", 200).build());
    c.invite_many(1, items);
    assert_eq!(c.get_hajat(1).unwrap().invite_count, 21);
}

// admin
#[test]
fn set_app_url_owner_only() {
    let mut c = fresh();
    testing_env!(ctx("owner.testnet", 0).build());
    c.set_app_url("https://new.example".into());
    assert_eq!(c.get_config().app_url, "https://new.example");
}

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn set_app_url_stranger() {
    let mut c = fresh();
    testing_env!(ctx("budi.testnet", 0).build());
    c.set_app_url("https://evil.example".into());
}

// card status table (docs/CONTRACTS.md section 3)
fn sample(state: InvState, released: u128, settled: u128, reciprocated: u128) -> Invitation {
    Invitation {
        token_id: 1,
        hajat_id: 1,
        owner: acct("budi.testnet"),
        label: "Budi".into(),
        note: String::new(),
        state,
        sealed: U128(0),
        released: U128(released),
        settled: U128(settled),
        reciprocated: U128(reciprocated),
        checked_in: false,
        created_at_ms: NOW_MS,
        sealed_at_ms: None,
        opened_at_ms: None,
        repays: vec![],
    }
}

fn hajat_with(status: HajatStatus) -> Hajat {
    Hajat {
        id: 1,
        host: acct("ayu.testnet"),
        title: "t".into(),
        kind: HajatKind::Wedding,
        venue: "".into(),
        event_at_ms: NOW_MS,
        join_policy: JoinPolicy::InviteOnly,
        status,
        invite_count: 1,
        sealed_total: U128(0),
        released_total: U128(0),
        created_at_ms: NOW_MS,
    }
}

#[test]
fn card_status_table() {
    let open = hajat_with(HajatStatus::Open);
    let cancelled = hajat_with(HajatStatus::Cancelled);
    assert_eq!(
        card_status(&sample(InvState::Invited, 0, 0, 0), &open),
        CardStatus::Invited
    );
    assert_eq!(
        card_status(&sample(InvState::Invited, 0, 0, 0), &cancelled),
        CardStatus::Void
    );
    assert_eq!(
        card_status(&sample(InvState::Sealed, 0, 0, 0), &open),
        CardStatus::Sealed
    );
    assert_eq!(
        card_status(&sample(InvState::Opening, 0, 0, 0), &open),
        CardStatus::Sealed
    );
    assert_eq!(
        card_status(&sample(InvState::Opened, 5, 0, 0), &open),
        CardStatus::Opened
    );
    assert_eq!(
        card_status(&sample(InvState::Opened, 5, 0, 3), &open),
        CardStatus::PartiallyRepaid
    );
    assert_eq!(
        card_status(&sample(InvState::Opened, 5, 0, 5), &open),
        CardStatus::Repaid
    );
    assert_eq!(
        card_status(&sample(InvState::Opened, 5, 5, 0), &open),
        CardStatus::Reply
    );
    assert_eq!(
        card_status(&sample(InvState::Opened, 8, 5, 0), &open),
        CardStatus::Opened
    );
    assert_eq!(
        card_status(&sample(InvState::Refunding, 0, 0, 0), &open),
        CardStatus::Refunded
    );
    assert_eq!(
        card_status(&sample(InvState::Refunded, 0, 0, 0), &cancelled),
        CardStatus::Refunded
    );
}
