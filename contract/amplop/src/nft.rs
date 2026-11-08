//! NEP-171 (core views, transfers disabled) and NEP-177 (metadata) for invitations.
//!
//! Invitations are soulbound: `nft_transfer` and `nft_transfer_call` always panic.
//! Approvals are not implemented. The `media` card is added with the SVG renderer.

use crate::constants::*;
use crate::errors::*;
use crate::types::{card_status, CardStatus, Hajat, Invitation};
use crate::{Contract, ContractExt};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, AccountId, PromiseOrValue};
use std::collections::HashMap;

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct NftContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub title: String,
    pub description: String,
    pub media: Option<String>,
    pub issued_at: Option<String>,
    pub reference: Option<String>,
    pub extra: Option<String>,
}

#[near(serializers=[json])]
#[derive(Clone, Debug)]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
    pub approved_account_ids: Option<HashMap<AccountId, u64>>,
}

fn describe(status: CardStatus, inv: &Invitation) -> String {
    match status {
        CardStatus::Invited => "Invited. Waiting for the guest to seal an envelope.".into(),
        CardStatus::Sealed => "Sealed. Opens at the event.".into(),
        CardStatus::Opened => "Opened. Waiting for its answer.".into(),
        CardStatus::PartiallyRepaid => "Opened. Partly repaid.".into(),
        CardStatus::Repaid => "Repaid.".into(),
        CardStatus::Reply => format!("Repaid {} envelope(s).", inv.repays.len()),
        CardStatus::Refunded => "Returned to the guest.".into(),
        CardStatus::Void => "Event cancelled.".into(),
    }
}

fn status_name(status: CardStatus) -> &'static str {
    match status {
        CardStatus::Invited => "Invited",
        CardStatus::Sealed => "Sealed",
        CardStatus::Opened => "Opened",
        CardStatus::PartiallyRepaid => "PartiallyRepaid",
        CardStatus::Repaid => "Repaid",
        CardStatus::Reply => "Reply",
        CardStatus::Refunded => "Refunded",
        CardStatus::Void => "Void",
    }
}

impl Contract {
    fn json_token(&self, inv: &Invitation, hajat: &Hajat) -> JsonToken {
        let status = card_status(inv, hajat);
        let title = &hajat.title;
        // The amount stays out of `extra` while the envelope is sealed.
        let extra = json!({
            "hajat_id": hajat.id,
            "status": status_name(status),
            "released": inv.released,
            "reciprocated": inv.reciprocated,
        })
        .to_string();
        JsonToken {
            token_id: inv.token_id.to_string(),
            owner_id: inv.owner.clone(),
            metadata: TokenMetadata {
                title: format!("Invitation #{}: {}", inv.token_id, title),
                description: describe(status, inv),
                media: None,
                issued_at: Some(inv.created_at_ms.to_string()),
                reference: Some(format!("{}/api/nft/{}", self.app_url, inv.token_id)),
                extra: Some(extra),
            },
            approved_account_ids: None,
        }
    }

    fn json_token_by_id(&self, token_id: u64) -> Option<JsonToken> {
        let inv = self.tokens.get(&token_id)?;
        let hajat = self.hajats.get(&inv.hajat_id)?;
        Some(self.json_token(inv, hajat))
    }
}

fn nft_page(from_index: Option<U128>, limit: Option<u64>) -> (u64, u64) {
    let from = from_index
        .map(|v| v.0)
        .unwrap_or(0)
        .min(u128::from(u64::MAX)) as u64;
    let limit = limit
        .unwrap_or(u64::from(DEFAULT_PAGE))
        .min(u64::from(MAX_PAGE));
    (from, limit)
}

#[near]
impl Contract {
    /// Always panics: invitations are soulbound. Payable so a standard wallet call with the
    /// required 1 yoctoNEAR gets this error and not a generic "deposit not accepted".
    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        let _ = (receiver_id, token_id, approval_id, memo);
        env::panic_str(ERR_SOULBOUND);
    }

    /// Always panics: invitations are soulbound.
    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        let _ = (receiver_id, token_id, approval_id, memo, msg);
        env::panic_str(ERR_SOULBOUND);
    }

    pub fn nft_metadata(&self) -> NftContractMetadata {
        NftContractMetadata {
            spec: "nft-1.0.0".into(),
            name: "Promise Invitations".into(),
            symbol: "AMPLOP".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn nft_token(&self, token_id: String) -> Option<JsonToken> {
        self.json_token_by_id(token_id.parse().ok()?)
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(u128::from(self.next_token - 1))
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(u128::from(
            self.owner_count.get(&account_id).copied().unwrap_or(0),
        ))
    }

    /// All invitations in mint order.
    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let (from, limit) = nft_page(from_index, limit);
        let last = self.next_token - 1;
        (1..=last)
            .skip(from as usize)
            .take(limit as usize)
            .filter_map(|id| self.json_token_by_id(id))
            .collect()
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let (from, limit) = nft_page(from_index, limit);
        let count = u64::from(self.owner_count.get(&account_id).copied().unwrap_or(0));
        (from..count.min(from.saturating_add(limit)))
            .filter_map(|idx| {
                self.owner_tokens
                    .get(&(account_id.clone(), idx as u32))
                    .copied()
            })
            .filter_map(|id| self.json_token_by_id(id))
            .collect()
    }
}
