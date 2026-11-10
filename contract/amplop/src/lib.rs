//! Promise `amplop` contract. Spec: docs/CONTRACTS.md.

mod activity;
mod constants;
mod errors;
mod escrow;
mod events;
mod hajat;
mod ledger;
mod nft;
mod refund;
mod svg;
mod types;
mod views;

#[cfg(test)]
mod tests;

use activity::ActivityEntry;
use constants::*;
use errors::*;
use ledger::{PairIndex, PairLedger};
use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
};
use types::{Hajat, HajatStatus, InvState, Invitation};

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Hajats,
    Tokens,
    HajatTokens,
    InviteOf,
    OwnerCount,
    OwnerTokens,
    HostCount,
    HostHajats,
    Pairs,
    OwedLen,
    OwedItems,
    OwedPos,
    OwesLen,
    OwesItems,
    OwesPos,
    Activity,
}

/// All collections are flat maps (no nested collections) so storage usage can be
/// measured exactly after `flush()`. Counters give the length of each list.
#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    owner: AccountId,
    ft: AccountId,
    app_url: String,
    /// next id to assign, starts at 1
    next_hajat: u64,
    /// next id to assign, starts at 1
    next_token: u64,
    hajats: LookupMap<u64, Hajat>,
    tokens: LookupMap<u64, Invitation>,
    /// (hajat id, position) -> token id. Length is `Hajat::invite_count`.
    hajat_tokens: LookupMap<(u64, u32), u64>,
    /// dedupe: (hajat id, guest) -> token id
    invite_of: LookupMap<(u64, AccountId), u64>,
    /// tokens never leave their owner (soulbound), so a plain append-only list is enough
    owner_count: LookupMap<AccountId, u32>,
    owner_tokens: LookupMap<(AccountId, u32), u64>,
    host_count: LookupMap<AccountId, u32>,
    host_hajats: LookupMap<(AccountId, u32), u64>,
    /// key (giver, receiver): what the receiver owes the giver
    pairs: LookupMap<(AccountId, AccountId), PairLedger>,
    /// giver -> receivers that owe them
    owed_to: PairIndex,
    /// receiver -> givers they owe
    owes: PairIndex,
    /// activity log, entries 0..activity_len
    activity: LookupMap<u32, ActivityEntry>,
    activity_len: u32,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, ft_id: AccountId, app_url: String) -> Self {
        require!(!env::state_exists(), ERR_BAD_INPUT);
        require!(app_url.chars().count() <= MAX_APP_URL, ERR_BAD_INPUT);
        Self {
            owner: owner_id,
            ft: ft_id,
            app_url,
            next_hajat: 1,
            next_token: 1,
            hajats: LookupMap::new(StorageKey::Hajats),
            tokens: LookupMap::new(StorageKey::Tokens),
            hajat_tokens: LookupMap::new(StorageKey::HajatTokens),
            invite_of: LookupMap::new(StorageKey::InviteOf),
            owner_count: LookupMap::new(StorageKey::OwnerCount),
            owner_tokens: LookupMap::new(StorageKey::OwnerTokens),
            host_count: LookupMap::new(StorageKey::HostCount),
            host_hajats: LookupMap::new(StorageKey::HostHajats),
            pairs: LookupMap::new(StorageKey::Pairs),
            owed_to: PairIndex::new(
                StorageKey::OwedLen,
                StorageKey::OwedItems,
                StorageKey::OwedPos,
            ),
            owes: PairIndex::new(
                StorageKey::OwesLen,
                StorageKey::OwesItems,
                StorageKey::OwesPos,
            ),
            activity: LookupMap::new(StorageKey::Activity),
            activity_len: 0,
        }
    }

    /// Owner only. Base URL used in the NEP-177 `reference` field.
    pub fn set_app_url(&mut self, url: String) {
        require!(env::predecessor_account_id() == self.owner, ERR_NOT_OWNER);
        require!(url.chars().count() <= MAX_APP_URL, ERR_BAD_INPUT);
        self.app_url = url;
    }
}

impl Contract {
    pub(crate) fn hajat_or_panic(&self, hajat_id: u64) -> Hajat {
        match self.hajats.get(&hajat_id) {
            Some(h) => h.clone(),
            None => env::panic_str(ERR_HAJAT_NOT_FOUND),
        }
    }

    pub(crate) fn require_host(&self, hajat: &Hajat) {
        require!(env::predecessor_account_id() == hajat.host, ERR_NOT_HOST);
    }

    /// Mints a soulbound invitation. Does not touch the deposit; callers settle storage once.
    /// Mutates `hajat` (the caller stores it back).
    pub(crate) fn mint_invitation(
        &mut self,
        hajat: &mut Hajat,
        owner: AccountId,
        label: String,
    ) -> u64 {
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);
        require!(hajat.invite_count < MAX_INVITES, ERR_QUOTA_FULL);
        require!(owner != hajat.host, ERR_BAD_INPUT);
        require!(
            !self.invite_of.contains_key(&(hajat.id, owner.clone())),
            ERR_ALREADY_INVITED
        );
        require_len(&label, 1, MAX_LABEL);

        let token_id = self.next_token;
        self.next_token = token_id
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str(ERR_OVERFLOW));

        let invitation = Invitation {
            token_id,
            hajat_id: hajat.id,
            owner: owner.clone(),
            label,
            note: String::new(),
            state: InvState::Invited,
            sealed: U128(0),
            released: U128(0),
            settled: U128(0),
            reciprocated: U128(0),
            checked_in: false,
            created_at_ms: env::block_timestamp_ms(),
            sealed_at_ms: None,
            opened_at_ms: None,
            repays: Vec::new(),
        };
        self.tokens.insert(token_id, invitation);
        self.hajat_tokens
            .insert((hajat.id, hajat.invite_count), token_id);
        hajat.invite_count += 1;
        self.invite_of.insert((hajat.id, owner.clone()), token_id);

        let n = self.owner_count.get(&owner).copied().unwrap_or(0);
        self.owner_tokens.insert((owner.clone(), n), token_id);
        self.owner_count.insert(owner, n + 1);
        token_id
    }

    /// NEAR left after storage staking. Seals and callbacks grow storage the contract pays for.
    pub(crate) fn spare_balance(&self) -> u128 {
        let locked = u128::from(env::storage_usage())
            .saturating_mul(env::storage_byte_cost().as_yoctonear());
        env::account_balance().as_yoctonear().saturating_sub(locked)
    }

    fn flush_all(&mut self) {
        self.hajats.flush();
        self.tokens.flush();
        self.hajat_tokens.flush();
        self.invite_of.flush();
        self.owner_count.flush();
        self.owner_tokens.flush();
        self.host_count.flush();
        self.host_hajats.flush();
        self.pairs.flush();
        self.owed_to.flush();
        self.owes.flush();
        self.activity.flush();
    }

    /// Requires the attached deposit to cover the bytes added since `start_usage`
    /// and refunds the excess to the caller.
    pub(crate) fn settle_storage(&mut self, start_usage: u64) {
        self.flush_all();
        let used = env::storage_usage().saturating_sub(start_usage);
        let cost = env::storage_byte_cost().saturating_mul(used as u128);
        let deposit = env::attached_deposit();
        require!(deposit >= cost, ERR_DEPOSIT_TOO_LOW);
        let refund = deposit.saturating_sub(cost);
        if refund > NearToken::from_yoctonear(0) {
            let _ = Promise::new(env::predecessor_account_id()).transfer(refund);
        }
    }
}

/// Character count in `min..=max`, else panic with `ERR_BAD_INPUT`.
pub(crate) fn require_len(s: &str, min: usize, max: usize) {
    let n = s.chars().count();
    require!(n >= min && n <= max, ERR_BAD_INPUT);
    if min > 0 {
        require!(!s.trim().is_empty(), ERR_BAD_INPUT);
    }
}
