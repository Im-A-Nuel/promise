//! The on-chain activity log. docs/CONTRACTS.md section 8.
//!
//! One entry per notable event, written in the same call that emits the NEP-297 event. It lets a UI show
//! a history without an indexer. The log holds the first `MAX_ACTIVITY` entries; after that it stops
//! growing, because every entry is storage the chain charges for.
//!
//! `record` must never panic: it also runs inside `on_open_resolved`, where a panic would leave a token
//! stuck in `Opening`. Storage for entries written by payable calls is paid by the caller, because the
//! caller's deposit is measured after the entry is written. Entries written in callbacks and in
//! `ft_on_transfer` are paid by the contract, which `MIN_SPARE_BALANCE` keeps funded.

use crate::constants::*;
use crate::{Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId};

#[near(serializers=[json, borsh])]
#[serde(rename_all = "snake_case")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActivityKind {
    HajatCreated,
    HajatCancelled,
    Invited,
    Joined,
    Sealed,
    CheckedIn,
    Opened,
    OpenFailed,
    /// `token_id` is the older token whose claim was repaid.
    Repaid,
    ClaimSkipped,
    Refunded,
    RefundFailed,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Debug)]
pub struct ActivityEntry {
    pub idx: u32,
    pub at_ms: u64,
    pub kind: ActivityKind,
    pub hajat_id: u64,
    /// 0 when the entry is about the hajat and not about one invitation
    pub token_id: u64,
    /// who acted: the host for hajat, invite, check-in and open entries, the guest for seals and repayments
    pub actor: AccountId,
    /// base units of tUSDC, 0 when the entry has no amount
    pub amount: U128,
}

impl Contract {
    /// Appends an entry. A full log silently stops recording.
    pub(crate) fn record(
        &mut self,
        kind: ActivityKind,
        hajat_id: u64,
        token_id: u64,
        actor: &AccountId,
        amount: u128,
    ) {
        if self.activity_len >= MAX_ACTIVITY {
            return;
        }
        let idx = self.activity_len;
        self.activity.insert(
            idx,
            ActivityEntry {
                idx,
                at_ms: env::block_timestamp_ms(),
                kind,
                hajat_id,
                token_id,
                actor: actor.clone(),
                amount: U128(amount),
            },
        );
        self.activity_len = idx.saturating_add(1);
    }
}

#[near]
impl Contract {
    /// Entries in the order they happened, `limit` at most 50. `from` is the index of the first entry.
    pub fn get_activity(&self, from: Option<u32>, limit: Option<u32>) -> Vec<ActivityEntry> {
        let from = from.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_PAGE).min(MAX_PAGE);
        let end = self.activity_len.min(from.saturating_add(limit));
        (from..end)
            .filter_map(|i| self.activity.get(&i).cloned())
            .collect()
    }

    /// The newest entries first, optionally only those of one hajat and/or one invitation.
    /// Looks back over at most the last `MAX_ACTIVITY_SCAN` entries, so an old, quiet token may show less
    /// than its full history. `limit` is at most 50.
    pub fn get_recent_activity(
        &self,
        hajat_id: Option<U64>,
        token_id: Option<U64>,
        limit: Option<u32>,
    ) -> Vec<ActivityEntry> {
        let limit = limit.unwrap_or(20).min(MAX_PAGE) as usize;
        let stop = self.activity_len.saturating_sub(MAX_ACTIVITY_SCAN);
        let mut out = Vec::new();
        let mut i = self.activity_len;
        while i > stop && out.len() < limit {
            i -= 1;
            let Some(entry) = self.activity.get(&i) else {
                continue;
            };
            if hajat_id.is_some_and(|h| h.0 != entry.hajat_id) {
                continue;
            }
            if token_id.is_some_and(|t| t.0 != entry.token_id) {
                continue;
            }
            out.push(entry.clone());
        }
        out
    }
}
