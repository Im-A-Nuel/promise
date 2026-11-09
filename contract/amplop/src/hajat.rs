//! Hajat lifecycle and invitations: create, policy, invite, invite_many, join.

use crate::activity::ActivityKind;
use crate::constants::*;
use crate::errors::*;
use crate::types::{Hajat, HajatKind, HajatStatus, InviteItem, JoinPolicy};
use crate::{events, require_len, Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, require};

#[near]
impl Contract {
    #[payable]
    pub fn create_hajat(
        &mut self,
        title: String,
        kind: HajatKind,
        venue: String,
        event_at_ms: u64,
        join_policy: JoinPolicy,
    ) -> U64 {
        let start = env::storage_usage();
        require_len(&title, 1, MAX_TITLE);
        require_len(&venue, 0, MAX_VENUE);
        let now = env::block_timestamp_ms();
        let latest = now
            .checked_add(MAX_EVENT_AHEAD_MS)
            .unwrap_or_else(|| env::panic_str(ERR_OVERFLOW));
        require!(event_at_ms >= now && event_at_ms <= latest, ERR_BAD_TIME);

        let host = env::predecessor_account_id();
        let id = self.next_hajat;
        self.next_hajat = id
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str(ERR_OVERFLOW));

        self.hajats.insert(
            id,
            Hajat {
                id,
                host: host.clone(),
                title,
                kind,
                venue,
                event_at_ms,
                join_policy,
                status: HajatStatus::Open,
                invite_count: 0,
                sealed_total: U128(0),
                released_total: U128(0),
                created_at_ms: now,
            },
        );
        let n = self.host_count.get(&host).copied().unwrap_or(0);
        self.host_hajats.insert((host.clone(), n), id);
        self.host_count.insert(host.clone(), n + 1);

        self.record(ActivityKind::HajatCreated, id, 0, &host, 0);
        self.settle_storage(start);
        events::hajat_created(id, &host, event_at_ms);
        U64(id)
    }

    pub fn set_join_policy(&mut self, hajat_id: u64, policy: JoinPolicy) {
        let mut hajat = self.hajat_or_panic(hajat_id);
        self.require_host(&hajat);
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);
        hajat.join_policy = policy;
        let host = hajat.host.clone();
        self.hajats.insert(hajat_id, hajat);
        events::hajat_updated(hajat_id, &host);
    }

    #[payable]
    pub fn invite(&mut self, hajat_id: u64, guest: near_sdk::AccountId, label: String) -> U64 {
        let start = env::storage_usage();
        let mut hajat = self.hajat_or_panic(hajat_id);
        self.require_host(&hajat);

        let token_id = self.mint_invitation(&mut hajat, guest.clone(), label);
        let host = hajat.host.clone();
        self.hajats.insert(hajat_id, hajat);

        self.record(ActivityKind::Invited, hajat_id, token_id, &host, 0);
        self.settle_storage(start);
        events::invited(hajat_id, token_id, &host, &guest);
        events::nft_mint(&guest, token_id);
        U64(token_id)
    }

    /// All or nothing: any failing item reverts the whole call.
    #[payable]
    pub fn invite_many(&mut self, hajat_id: u64, items: Vec<InviteItem>) -> Vec<U64> {
        let start = env::storage_usage();
        require!(
            !items.is_empty() && items.len() <= MAX_INVITE_BATCH,
            ERR_BAD_INPUT
        );
        let mut hajat = self.hajat_or_panic(hajat_id);
        self.require_host(&hajat);

        let mut minted: Vec<(u64, near_sdk::AccountId)> = Vec::with_capacity(items.len());
        for item in items {
            let token_id = self.mint_invitation(&mut hajat, item.guest.clone(), item.label);
            minted.push((token_id, item.guest));
        }
        let host = hajat.host.clone();
        self.hajats.insert(hajat_id, hajat);

        for (token_id, _) in &minted {
            self.record(ActivityKind::Invited, hajat_id, *token_id, &host, 0);
        }
        self.settle_storage(start);
        for (token_id, guest) in &minted {
            events::invited(hajat_id, *token_id, &host, guest);
            events::nft_mint(guest, *token_id);
        }
        minted.into_iter().map(|(id, _)| U64(id)).collect()
    }

    /// Self-service RSVP on an `OpenLink` hajat.
    #[payable]
    pub fn join(&mut self, hajat_id: u64, label: String) -> U64 {
        let start = env::storage_usage();
        let mut hajat = self.hajat_or_panic(hajat_id);
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);
        require!(hajat.join_policy == JoinPolicy::OpenLink, ERR_INVITE_ONLY);

        let guest = env::predecessor_account_id();
        let token_id = self.mint_invitation(&mut hajat, guest.clone(), label);
        let host = hajat.host.clone();
        self.hajats.insert(hajat_id, hajat);

        self.record(ActivityKind::Joined, hajat_id, token_id, &guest, 0);
        self.settle_storage(start);
        events::joined(hajat_id, token_id, &host, &guest);
        events::nft_mint(&guest, token_id);
        U64(token_id)
    }
}
