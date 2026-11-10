//! Phase 4 unit tests: ledger settlement (T-20 to T-27) and its invariants.

use super::escrow::*;
use super::*;
use crate::ledger::owed_now;
use near_sdk::{Gas, PromiseResult};

const UNIT: u128 = 1_000_000;

pub(super) fn name(n: &str) -> String {
    format!("{n}.testnet")
}

/// A fresh hajat hosted by `host`, event 12 hours away so the host window is open.
pub(super) fn hajat_of(c: &mut Contract, host: &str) -> u64 {
    testing_env!(ctx(&name(host), 50).build());
    c.create_hajat(
        format!("Acara {host}"),
        HajatKind::Wedding,
        "Gedung".into(),
        NOW_MS + HOURS_12_MS,
        JoinPolicy::InviteOnly,
    )
    .0
}

/// `guest` gets invited to `hajat`, seals `amount` and the host opens it. Returns the token id.
pub(super) fn gift(c: &mut Contract, hajat: u64, guest: &str, amount: u128) -> u64 {
    let host = c.get_hajat(hajat).unwrap().host.to_string();
    testing_env!(ctx(&host, 50).build());
    let token = c.invite(hajat, acct(&name(guest)), guest.to_string()).0;
    on_transfer(c, TUSDC, &name(guest), amount, seal_msg(token, None));
    testing_env!(ctx_at(&host, NOW_MS, 0, gas150()).build());
    let _ = c.open(token);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, Gas::from_tgas(60)).build(),
        PromiseResult::Successful(vec![]),
    );
    assert!(c.on_open_resolved(token, U128(amount)));
    token
}

fn pair(c: &Contract, giver: &str, receiver: &str) -> (u128, Vec<u64>) {
    let p = c.get_pair(acct(&name(giver)), acct(&name(receiver)));
    (p.remaining.0, p.open.iter().map(|v| v.0).collect())
}

fn view(c: &Contract, token: u64) -> crate::types::InvitationView {
    c.get_invitation(token).unwrap()
}

// T-20
#[test]
fn t20_first_gift_creates_a_claim() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    let t = gift(&mut c, h, "budi", 5 * UNIT);

    let v = view(&c, t);
    assert_eq!(v.state, InvState::Opened);
    assert_eq!(v.settled, U128(0));
    assert_eq!(v.card_status, CardStatus::Opened);
    assert_eq!(pair(&c, "budi", "ayu"), (5 * UNIT, vec![t]));

    let ayu = c.get_ledger(acct(&name("ayu")), None, None);
    assert!(ayu.owed_to_me.is_empty());
    assert_eq!(ayu.i_owe.len(), 1);
    assert_eq!(ayu.i_owe[0].counterparty, acct(&name("budi")));
    assert_eq!(ayu.i_owe[0].remaining, U128(5 * UNIT));
    let budi = c.get_ledger(acct(&name("budi")), None, None);
    assert_eq!(budi.owed_to_me.len(), 1);
    assert_eq!(budi.owed_to_me[0].counterparty, acct(&name("ayu")));
    assert!(budi.i_owe.is_empty());
    check_invariants(&c, &["ayu", "budi"]);
}

// T-21
#[test]
fn t21_reply_equal_to_the_debt() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let old = gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h2, "ayu", 5 * UNIT);

    let r = view(&c, reply);
    assert_eq!(r.settled, U128(5 * UNIT));
    assert_eq!(r.card_status, CardStatus::Reply);
    assert_eq!(r.repays, vec![(old, U128(5 * UNIT))]);
    let o = view(&c, old);
    assert_eq!(o.reciprocated, U128(5 * UNIT));
    assert_eq!(o.card_status, CardStatus::Repaid);
    assert_eq!(pair(&c, "budi", "ayu"), (0, vec![]));
    assert_eq!(pair(&c, "ayu", "budi"), (0, vec![]));
    assert!(c
        .get_ledger(acct(&name("ayu")), None, None)
        .i_owe
        .is_empty());
    assert!(c
        .get_ledger(acct(&name("budi")), None, None)
        .owed_to_me
        .is_empty());
    check_invariants(&c, &["ayu", "budi"]);
}

// T-22
#[test]
fn t22_reply_larger_than_the_debt() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let old = gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h2, "ayu", 8 * UNIT);

    assert_eq!(view(&c, old).card_status, CardStatus::Repaid);
    let r = view(&c, reply);
    assert_eq!(r.settled, U128(5 * UNIT));
    assert_eq!(r.card_status, CardStatus::Opened, "3 of credit is left");
    assert_eq!(pair(&c, "budi", "ayu"), (0, vec![]));
    assert_eq!(pair(&c, "ayu", "budi"), (3 * UNIT, vec![reply]));
    let budi = c.get_ledger(acct(&name("budi")), None, None);
    assert_eq!(budi.i_owe.len(), 1);
    assert_eq!(budi.i_owe[0].remaining, U128(3 * UNIT));
    check_invariants(&c, &["ayu", "budi"]);
}

// T-23
#[test]
fn t23_reply_smaller_than_the_debt() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let old = gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h2, "ayu", 3 * UNIT);

    let o = view(&c, old);
    assert_eq!(o.reciprocated, U128(3 * UNIT));
    assert_eq!(o.card_status, CardStatus::PartiallyRepaid);
    assert_eq!(pair(&c, "budi", "ayu"), (2 * UNIT, vec![old]));
    assert_eq!(view(&c, reply).card_status, CardStatus::Reply);
    check_invariants(&c, &["ayu", "budi"]);
}

// T-24
#[test]
fn t24_one_reply_covers_two_claims_oldest_first() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let first = gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "ayu");
    let second = gift(&mut c, h2, "budi", 2 * UNIT);
    assert_eq!(pair(&c, "budi", "ayu"), (7 * UNIT, vec![first, second]));

    let h3 = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h3, "ayu", 6 * UNIT);
    let r = view(&c, reply);
    assert_eq!(
        r.repays,
        vec![(first, U128(5 * UNIT)), (second, U128(UNIT))]
    );
    assert_eq!(view(&c, first).card_status, CardStatus::Repaid);
    assert_eq!(view(&c, second).card_status, CardStatus::PartiallyRepaid);
    assert_eq!(pair(&c, "budi", "ayu"), (UNIT, vec![second]));
    check_invariants(&c, &["ayu", "budi"]);
}

// T-25
#[test]
fn t25_only_ten_claims_are_repaid_per_opening() {
    let mut c = fresh();
    let mut old = Vec::new();
    for _ in 0..12 {
        let h = hajat_of(&mut c, "ayu");
        old.push(gift(&mut c, h, "budi", UNIT));
    }
    assert_eq!(pair(&c, "budi", "ayu").0, 12 * UNIT);

    let h = hajat_of(&mut c, "budi");
    let reply = gift(&mut c, h, "ayu", 100 * UNIT);
    let r = view(&c, reply);
    assert_eq!(r.repays.len(), 10);
    assert_eq!(r.settled, U128(10 * UNIT));
    for id in &old[..10] {
        assert_eq!(view(&c, *id).card_status, CardStatus::Repaid);
    }
    for id in &old[10..] {
        assert_eq!(view(&c, *id).card_status, CardStatus::Opened);
    }
    // two old claims remain, and 90 of new credit goes the other way
    assert_eq!(pair(&c, "budi", "ayu"), (2 * UNIT, vec![old[10], old[11]]));
    assert_eq!(pair(&c, "ayu", "budi"), (90 * UNIT, vec![reply]));
    check_invariants(&c, &["ayu", "budi"]);
}

// T-27
#[test]
fn t27_suggest_reply_matches_the_pair() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    gift(&mut c, h1, "budi", 5 * UNIT);
    gift(&mut c, h1, "citra", 2 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    assert_eq!(c.suggest_reply(h2, acct(&name("ayu"))), U128(5 * UNIT));
    assert_eq!(
        c.suggest_reply(h2, acct(&name("ayu"))).0,
        c.get_pair(acct(&name("budi")), acct(&name("ayu")))
            .remaining
            .0
    );
    assert_eq!(c.suggest_reply(h2, acct(&name("citra"))), U128(0));
    assert_eq!(c.suggest_reply(999, acct(&name("ayu"))), U128(0));
}

#[test]
fn the_readme_story() {
    // Budi 5 and Citra 2 at Ayu's wedding, Dewi 5 on the day, then Ayu repays Budi.
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    let tb = gift(&mut c, h1, "budi", 5 * UNIT);
    let tc = gift(&mut c, h1, "citra", 2 * UNIT);
    let td = gift(&mut c, h1, "dewi", 5 * UNIT);

    let ledger = c.get_ledger(acct(&name("ayu")), None, None);
    let owed: Vec<(String, u128)> = ledger
        .i_owe
        .iter()
        .map(|r| (r.counterparty.to_string(), r.remaining.0))
        .collect();
    assert_eq!(
        owed,
        vec![
            (name("budi"), 5 * UNIT),
            (name("citra"), 2 * UNIT),
            (name("dewi"), 5 * UNIT)
        ]
    );

    let h2 = hajat_of(&mut c, "budi");
    assert_eq!(c.suggest_reply(h2, acct(&name("ayu"))), U128(5 * UNIT));
    let reply = gift(&mut c, h2, "ayu", 5 * UNIT);
    assert_eq!(view(&c, tb).card_status, CardStatus::Repaid);
    assert_eq!(view(&c, reply).card_status, CardStatus::Reply);
    assert_eq!(view(&c, tc).card_status, CardStatus::Opened);
    assert_eq!(view(&c, td).card_status, CardStatus::Opened);
    let after = c.get_ledger(acct(&name("ayu")), None, None);
    assert_eq!(after.i_owe.len(), 2, "Budi is gone from the list");
    check_invariants(&c, &["ayu", "budi", "citra", "dewi"]);
}

#[test]
fn ledger_paging() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    for i in 0..5 {
        gift(&mut c, h, &format!("g{i}"), UNIT);
    }
    let all = c.get_ledger(acct(&name("ayu")), None, None).i_owe;
    assert_eq!(all.len(), 5);
    let page = c.get_ledger(acct(&name("ayu")), Some(1), Some(2)).i_owe;
    assert_eq!(page.len(), 2);
    assert_eq!(page[0].counterparty, all[1].counterparty);
    assert!(c
        .get_ledger(acct(&name("ayu")), Some(5), None)
        .i_owe
        .is_empty());
}

#[test]
fn removing_from_the_middle_of_the_index_keeps_the_rest() {
    let mut c = fresh();
    let h = hajat_of(&mut c, "ayu");
    gift(&mut c, h, "budi", UNIT);
    gift(&mut c, h, "citra", UNIT);
    gift(&mut c, h, "dewi", UNIT);
    // Ayu repays Citra exactly, which removes the middle entry
    let hc = hajat_of(&mut c, "citra");
    gift(&mut c, hc, "ayu", UNIT);
    let left: Vec<String> = c
        .get_ledger(acct(&name("ayu")), None, None)
        .i_owe
        .iter()
        .map(|r| r.counterparty.to_string())
        .collect();
    assert_eq!(left.len(), 2);
    assert!(left.contains(&name("budi")) && left.contains(&name("dewi")));
    check_invariants(&c, &["ayu", "budi", "citra", "dewi"]);
}

#[test]
fn a_pair_never_holds_more_than_fifty_open_claims() {
    let mut c = fresh();
    for _ in 0..MAX_PAIR_OPEN {
        let h = hajat_of(&mut c, "ayu");
        gift(&mut c, h, "budi", UNIT);
    }
    let h = hajat_of(&mut c, "ayu");
    let skipped = gift(&mut c, h, "budi", UNIT);
    let (remaining, open) = pair(&c, "budi", "ayu");
    assert_eq!(open.len(), MAX_PAIR_OPEN);
    assert_eq!(remaining, MAX_PAIR_OPEN as u128 * UNIT);
    assert!(!open.contains(&skipped));
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"claim_skipped""#)));
}

#[test]
fn repaid_events_are_emitted() {
    let mut c = fresh();
    let h1 = hajat_of(&mut c, "ayu");
    gift(&mut c, h1, "budi", 5 * UNIT);
    let h2 = hajat_of(&mut c, "budi");
    gift(&mut c, h2, "ayu", 5 * UNIT);
    assert!(near_sdk::test_utils::get_logs()
        .iter()
        .any(|l| l.contains(r#""event":"repaid""#) && l.contains(r#""amount":"5000000""#)));
}

// T-26: invariants hold after a random sequence of 50 operations.
// One test per seed: the mocked storage lives per thread, so a second `fresh()` inside one test
// would start on top of the first contract's data.
const PEOPLE: [&str; 6] = ["ayu", "budi", "citra", "dewi", "eko", "fajar"];

fn random_operations(seed: u64) {
    let mut c = fresh();
    let mut rng = seed;
    let mut next = move || {
        rng = rng
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (rng >> 33) as usize
    };
    for _ in 0..50 {
        let hi = next() % PEOPLE.len();
        let gi = (hi + 1 + next() % (PEOPLE.len() - 1)) % PEOPLE.len();
        let amount = (next() % 9 + 1) as u128 * UNIT;
        let h = hajat_of(&mut c, PEOPLE[hi]);
        gift(&mut c, h, PEOPLE[gi], amount);
        check_invariants(&c, &PEOPLE);
    }
}

#[test]
fn t26_random_operations_seed_1() {
    random_operations(1);
}

#[test]
fn t26_random_operations_seed_7() {
    random_operations(7);
}

#[test]
fn t26_random_operations_seed_42() {
    random_operations(42);
}

#[test]
fn t26_random_operations_seed_2026() {
    random_operations(2026);
}

/// The five ledger invariants of docs/CONTRACTS.md section 6, checked over `people`.
fn check_invariants(c: &Contract, people: &[&str]) {
    let last = c.get_config().token_count;

    // 1. per token
    for id in 1..=last {
        let t = view(c, id);
        assert!(
            t.settled.0 <= t.released.0,
            "token {id}: settled <= released"
        );
        assert!(
            t.reciprocated.0 <= t.released.0 - t.settled.0,
            "token {id}: reciprocated <= credit"
        );
    }

    let mut in_pairs: Vec<u64> = Vec::new();
    for g in people {
        for h in people {
            if g == h {
                continue;
            }
            let (remaining, open) = pair(c, g, h);
            // 2. pair total equals the sum of what is owed on its open claims
            let sum: u128 = open
                .iter()
                .map(|id| {
                    let t = c.tokens.get(id).unwrap();
                    owed_now(t)
                })
                .sum();
            assert_eq!(
                remaining, sum,
                "pair {g}->{h}: remaining equals sum of open claims"
            );
            for id in &open {
                let t = view(c, *id);
                assert_eq!(t.state, InvState::Opened);
                assert_eq!(t.owner, acct(&name(g)), "claim owner is the giver");
                assert!(
                    owed_now(c.tokens.get(id).unwrap()) > 0,
                    "open claim owes something"
                );
                in_pairs.push(*id);
            }
            // the indexes list exactly the pairs that exist
            let listed_owed = c.owed_to.contains(&acct(&name(g)), &acct(&name(h)));
            let listed_owes = c.owes.contains(&acct(&name(h)), &acct(&name(g)));
            assert_eq!(listed_owed, !open.is_empty(), "owed_to index {g}->{h}");
            assert_eq!(listed_owes, !open.is_empty(), "owes index {h}->{g}");
        }
    }

    // 3. hajat released_total equals the sum of its tokens
    for hid in 1..=c.get_config().hajat_count {
        let sum: u128 = (1..=last)
            .map(|id| view(c, id))
            .filter(|t| t.hajat_id == hid)
            .map(|t| t.released.0)
            .sum();
        assert_eq!(
            c.get_hajat(hid).unwrap().released_total.0,
            sum,
            "hajat {hid} released_total"
        );
    }

    // 5. a token is in a pair if and only if it is Opened and still owed
    for id in 1..=last {
        let t = c.tokens.get(&id).unwrap();
        let should = t.state == InvState::Opened && owed_now(t) > 0;
        assert_eq!(in_pairs.contains(&id), should, "token {id} membership");
    }

    // ledger rows agree with pairs
    for p in people {
        let l = c.get_ledger(acct(&name(p)), None, Some(50));
        for row in l.owed_to_me {
            let cp = row.counterparty.to_string();
            let cp = cp.trim_end_matches(".testnet");
            assert_eq!(pair(c, p, cp).0, row.remaining.0);
        }
        for row in l.i_owe {
            let cp = row.counterparty.to_string();
            let cp = cp.trim_end_matches(".testnet");
            assert_eq!(pair(c, cp, p).0, row.remaining.0);
        }
    }
}
