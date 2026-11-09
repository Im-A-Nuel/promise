//! Read-only methods. Lists take `from` (offset) and `limit` (capped at MAX_PAGE).

use crate::constants::*;
use crate::types::{Config, Hajat, InvitationView};
use crate::{Contract, ContractExt};
use near_sdk::{near, AccountId};

fn page(from: Option<u32>, limit: Option<u32>) -> (u32, u32) {
    (
        from.unwrap_or(0),
        limit.unwrap_or(DEFAULT_PAGE).min(MAX_PAGE),
    )
}

#[near]
impl Contract {
    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            ft: self.ft.clone(),
            app_url: self.app_url.clone(),
            hajat_count: self.next_hajat - 1,
            token_count: self.next_token - 1,
            spare_balance: near_sdk::json_types::U128(self.spare_balance()),
            activity_count: self.activity_len,
        }
    }

    pub fn get_hajat(&self, hajat_id: u64) -> Option<Hajat> {
        self.hajats.get(&hajat_id).cloned()
    }

    /// Newest first. `from` is an offset from the newest hajat.
    pub fn get_hajats(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Hajat> {
        let (from, limit) = page(from, limit);
        let total = self.next_hajat - 1;
        (0..u64::from(limit))
            .filter_map(|i| total.checked_sub(u64::from(from) + i))
            .filter(|id| *id >= 1)
            .filter_map(|id| self.hajats.get(&id).cloned())
            .collect()
    }

    /// Newest first. `from` is an offset from the host's newest hajat.
    pub fn get_hajats_by_host(
        &self,
        host: AccountId,
        from: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Hajat> {
        let (from, limit) = page(from, limit);
        let n = self.host_count.get(&host).copied().unwrap_or(0);
        (0..limit)
            .filter_map(|i| n.checked_sub(from.saturating_add(i) + 1))
            .filter_map(|idx| self.host_hajats.get(&(host.clone(), idx)).copied())
            .filter_map(|id| self.hajats.get(&id).cloned())
            .collect()
    }

    pub fn get_invitation(&self, token_id: u64) -> Option<InvitationView> {
        let inv = self.tokens.get(&token_id)?;
        let hajat = self.hajats.get(&inv.hajat_id)?;
        Some(inv.view(hajat))
    }

    /// Oldest first, in invitation order.
    pub fn get_invitations(
        &self,
        hajat_id: u64,
        from: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<InvitationView> {
        let (from, limit) = page(from, limit);
        let Some(hajat) = self.hajats.get(&hajat_id) else {
            return Vec::new();
        };
        let end = hajat.invite_count.min(from.saturating_add(limit));
        (from..end)
            .filter_map(|idx| self.hajat_tokens.get(&(hajat_id, idx)).copied())
            .filter_map(|token_id| self.tokens.get(&token_id))
            .map(|inv| inv.view(hajat))
            .collect()
    }

    pub fn get_invitation_for(&self, hajat_id: u64, account: AccountId) -> Option<InvitationView> {
        let token_id = self.invite_of.get(&(hajat_id, account)).copied()?;
        self.get_invitation(token_id)
    }
}
