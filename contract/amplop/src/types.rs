//! Stored and returned types. Amounts are `U128` so JSON clients see decimal strings.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers=[json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HajatKind {
    Wedding,
    Khitan,
    Birth,
    Syukuran,
    Duka,
    Other,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum JoinPolicy {
    InviteOnly,
    OpenLink,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HajatStatus {
    Open,
    Cancelled,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum InvState {
    Invited,
    Sealed,
    Opening,
    Opened,
    Refunding,
    Refunded,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CardStatus {
    Invited,
    Sealed,
    Opened,
    PartiallyRepaid,
    Repaid,
    Reply,
    Refunded,
    Void,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Debug)]
pub struct Hajat {
    pub id: u64,
    pub host: AccountId,
    pub title: String,
    pub kind: HajatKind,
    pub venue: String,
    pub event_at_ms: u64,
    pub join_policy: JoinPolicy,
    pub status: HajatStatus,
    pub invite_count: u32,
    pub sealed_total: U128,
    pub released_total: U128,
    pub created_at_ms: u64,
}

#[near(serializers=[json, borsh])]
#[derive(Clone, Debug)]
pub struct Invitation {
    pub token_id: u64,
    pub hajat_id: u64,
    pub owner: AccountId,
    pub label: String,
    pub note: String,
    pub state: InvState,
    /// currently locked
    pub sealed: U128,
    /// moved to the host when opened
    pub released: U128,
    /// part of `released` used to repay older claims
    pub settled: U128,
    /// part of the credit the host has paid back since
    pub reciprocated: U128,
    pub checked_in: bool,
    pub created_at_ms: u64,
    pub sealed_at_ms: Option<u64>,
    pub opened_at_ms: Option<u64>,
    /// (older token id, amount) this token repaid
    pub repays: Vec<(u64, U128)>,
}

/// Invitation as returned by views: the stored fields plus the derived card status.
#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct InvitationView {
    pub token_id: u64,
    pub hajat_id: u64,
    pub owner: AccountId,
    pub label: String,
    pub note: String,
    pub state: InvState,
    pub card_status: CardStatus,
    pub sealed: U128,
    pub released: U128,
    pub settled: U128,
    pub reciprocated: U128,
    pub checked_in: bool,
    pub created_at_ms: u64,
    pub sealed_at_ms: Option<u64>,
    pub opened_at_ms: Option<u64>,
    pub repays: Vec<(u64, U128)>,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct InviteItem {
    pub guest: AccountId,
    pub label: String,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub owner: AccountId,
    pub ft: AccountId,
    pub app_url: String,
    pub hajat_count: u64,
    pub token_count: u64,
    /// NEAR left after storage staking, in yocto. Keep it above `MIN_SPARE_BALANCE`.
    pub spare_balance: U128,
    /// entries in the activity log
    pub activity_count: u32,
}

/// Display status derived from stored state (docs/CONTRACTS.md section 3).
pub fn card_status(inv: &Invitation, hajat: &Hajat) -> CardStatus {
    match inv.state {
        InvState::Invited => {
            if hajat.status == HajatStatus::Cancelled {
                CardStatus::Void
            } else {
                CardStatus::Invited
            }
        }
        InvState::Sealed | InvState::Opening => CardStatus::Sealed,
        InvState::Refunding | InvState::Refunded => CardStatus::Refunded,
        InvState::Opened => {
            let credit = inv.released.0.saturating_sub(inv.settled.0);
            if credit == 0 {
                CardStatus::Reply
            } else if inv.reciprocated.0 == 0 {
                CardStatus::Opened
            } else if inv.reciprocated.0 < credit {
                CardStatus::PartiallyRepaid
            } else {
                CardStatus::Repaid
            }
        }
    }
}

impl Invitation {
    pub fn view(&self, hajat: &Hajat) -> InvitationView {
        InvitationView {
            token_id: self.token_id,
            hajat_id: self.hajat_id,
            owner: self.owner.clone(),
            label: self.label.clone(),
            note: self.note.clone(),
            state: self.state,
            card_status: card_status(self, hajat),
            sealed: self.sealed,
            released: self.released,
            settled: self.settled,
            reciprocated: self.reciprocated,
            checked_in: self.checked_in,
            created_at_ms: self.created_at_ms,
            sealed_at_ms: self.sealed_at_ms,
            opened_at_ms: self.opened_at_ms,
            repays: self.repays.clone(),
        }
    }
}
