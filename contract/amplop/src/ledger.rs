//! The gift ledger. docs/CONTRACTS.md section 6.
//!
//! When guest G's envelope opens at host H's hajat, H owes G that amount: pair (giver G, receiver H).
//! The same opening first repays older claims the other way round, pair (giver H, receiver G),
//! oldest first, at most `MAX_SETTLE` per opening. What is left becomes a new claim.
//!
//! Settlement runs only inside `on_open_resolved`, after the money has moved. Storage for the
//! ledger is paid by the contract account, because a callback cannot receive a deposit.

use crate::activity::ActivityKind;
use crate::constants::*;
use crate::events;
use crate::types::Invitation;
use crate::{Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::store::LookupMap;
use near_sdk::{near, AccountId, IntoStorageKey};

/// Open claims of one pair, oldest first, and their total still owed.
#[near(serializers=[json, borsh])]
#[derive(Clone, Debug, Default)]
pub struct PairLedger {
    pub remaining: U128,
    pub open: Vec<u64>,
}

/// A set of counterparties per account with O(1) add and remove. Flat maps only, so storage
/// usage stays exact after `flush()`.
#[near(serializers=[borsh])]
pub struct PairIndex {
    len: LookupMap<AccountId, u32>,
    items: LookupMap<(AccountId, u32), AccountId>,
    pos: LookupMap<(AccountId, AccountId), u32>,
}

impl PairIndex {
    pub fn new<A, B, C>(len_key: A, items_key: B, pos_key: C) -> Self
    where
        A: IntoStorageKey,
        B: IntoStorageKey,
        C: IntoStorageKey,
    {
        Self {
            len: LookupMap::new(len_key),
            items: LookupMap::new(items_key),
            pos: LookupMap::new(pos_key),
        }
    }

    pub fn count(&self, owner: &AccountId) -> u32 {
        self.len.get(owner).copied().unwrap_or(0)
    }

    pub fn get(&self, owner: &AccountId, idx: u32) -> Option<AccountId> {
        self.items.get(&(owner.clone(), idx)).cloned()
    }

    pub fn contains(&self, owner: &AccountId, other: &AccountId) -> bool {
        self.pos.contains_key(&(owner.clone(), other.clone()))
    }

    pub fn add(&mut self, owner: &AccountId, other: &AccountId) {
        if self.contains(owner, other) {
            return;
        }
        let n = self.count(owner);
        self.items.insert((owner.clone(), n), other.clone());
        self.pos.insert((owner.clone(), other.clone()), n);
        self.len.insert(owner.clone(), n + 1);
    }

    pub fn remove(&mut self, owner: &AccountId, other: &AccountId) {
        let Some(p) = self.pos.remove(&(owner.clone(), other.clone())) else {
            return;
        };
        let last = self.count(owner) - 1;
        if p != last {
            if let Some(moved) = self.items.get(&(owner.clone(), last)).cloned() {
                self.items.insert((owner.clone(), p), moved.clone());
                self.pos.insert((owner.clone(), moved), p);
            }
        }
        self.items.remove(&(owner.clone(), last));
        if last == 0 {
            self.len.remove(owner);
        } else {
            self.len.insert(owner.clone(), last);
        }
    }

    pub fn flush(&mut self) {
        self.len.flush();
        self.items.flush();
        self.pos.flush();
    }
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct LedgerRow {
    pub counterparty: AccountId,
    pub remaining: U128,
    pub token_ids: Vec<U64>,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct Ledger {
    /// The counterparty owes me.
    pub owed_to_me: Vec<LedgerRow>,
    /// I owe the counterparty.
    pub i_owe: Vec<LedgerRow>,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct PairView {
    pub remaining: U128,
    pub open: Vec<U64>,
}

/// What the host still owes the guest on this token: credit minus what was already paid back.
pub fn owed_now(inv: &Invitation) -> u128 {
    inv.released
        .0
        .saturating_sub(inv.settled.0)
        .saturating_sub(inv.reciprocated.0)
}

impl Contract {
    /// Settles an opened envelope against the ledger. `token` is the freshly opened invitation
    /// (state already `Opened`, `released` set) and is mutated; older tokens are stored here.
    /// Returns the claims it repaid as (older token id, amount).
    pub(crate) fn settle(&mut self, token: &mut Invitation, host: &AccountId) -> Vec<(u64, u128)> {
        let guest = token.owner.clone();
        let mut left = token.released.0;
        let mut repays: Vec<(u64, u128)> = Vec::new();

        // What the guest owes the host from the host's earlier gifts to the guest.
        let older_key = (host.clone(), guest.clone());
        if let Some(mut older) = self.pairs.get(&older_key).cloned() {
            let mut i = 0;
            let mut iterations = 0;
            while i < older.open.len() && left > 0 && iterations < MAX_SETTLE {
                let id = older.open[i];
                iterations += 1;
                let Some(mut claim) = self.tokens.get(&id).cloned() else {
                    i += 1;
                    continue;
                };
                let need = owed_now(&claim);
                let pay = need.min(left);
                claim.reciprocated = U128(claim.reciprocated.0 + pay);
                older.remaining = U128(older.remaining.0.saturating_sub(pay));
                left -= pay;
                token.settled = U128(token.settled.0 + pay);
                token.repays.push((id, U128(pay)));
                repays.push((id, pay));
                self.tokens.insert(id, claim);
                if pay == need {
                    older.open.remove(i);
                } else {
                    i += 1;
                }
            }
            if older.open.is_empty() {
                self.pairs.remove(&older_key);
                self.owed_to.remove(host, &guest);
                self.owes.remove(&guest, host);
            } else {
                self.pairs.insert(older_key, older);
            }
        }

        // Whatever was not used for repayment is a new claim of the guest on the host.
        let credit = token.released.0 - token.settled.0;
        if credit > 0 {
            let key = (guest.clone(), host.clone());
            let mut pair = self.pairs.get(&key).cloned().unwrap_or_default();
            if pair.open.len() >= MAX_PAIR_OPEN {
                events::claim_skipped(token.hajat_id, token.token_id, &guest, host, credit);
                self.record(
                    ActivityKind::ClaimSkipped,
                    token.hajat_id,
                    token.token_id,
                    &guest,
                    credit,
                );
            } else {
                pair.open.push(token.token_id);
                pair.remaining = U128(pair.remaining.0 + credit);
                self.pairs.insert(key, pair);
                self.owed_to.add(&guest, host);
                self.owes.add(host, &guest);
            }
        }
        repays
    }

    fn rows(&self, account: &AccountId, as_giver: bool, from: u32, limit: u32) -> Vec<LedgerRow> {
        let index = if as_giver { &self.owed_to } else { &self.owes };
        let count = index.count(account);
        (from..count.min(from.saturating_add(limit)))
            .filter_map(|idx| index.get(account, idx))
            .filter_map(|other| {
                let key = if as_giver {
                    (account.clone(), other.clone())
                } else {
                    (other.clone(), account.clone())
                };
                let pair = self.pairs.get(&key)?;
                Some(LedgerRow {
                    counterparty: other,
                    remaining: pair.remaining,
                    token_ids: pair.open.iter().copied().map(U64).collect(),
                })
            })
            .collect()
    }
}

#[near]
impl Contract {
    /// Who owes me and whom I owe. `from` and `limit` page each list separately (limit max 50).
    pub fn get_ledger(
        &self,
        account_id: AccountId,
        from: Option<u32>,
        limit: Option<u32>,
    ) -> Ledger {
        let from = from.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_PAGE).min(MAX_PAGE);
        Ledger {
            owed_to_me: self.rows(&account_id, true, from, limit),
            i_owe: self.rows(&account_id, false, from, limit),
        }
    }

    /// Claims of `giver` on `receiver`: what the receiver owes the giver.
    pub fn get_pair(&self, giver: AccountId, receiver: AccountId) -> PairView {
        let pair = self
            .pairs
            .get(&(giver, receiver))
            .cloned()
            .unwrap_or_default();
        PairView {
            remaining: pair.remaining,
            open: pair.open.into_iter().map(U64).collect(),
        }
    }

    /// Suggested envelope for `guest` at this hajat: what the guest still owes the host.
    pub fn suggest_reply(&self, hajat_id: u64, guest: AccountId) -> U128 {
        let Some(hajat) = self.hajats.get(&hajat_id) else {
            return U128(0);
        };
        self.pairs
            .get(&(hajat.host.clone(), guest))
            .map(|p| p.remaining)
            .unwrap_or_default()
    }
}
