//! Cancelling a hajat and returning sealed envelopes to their owners.
//!
//! Refunds mirror the open flow: lock as `Refunding`, `ft_transfer` to the owner,
//! finish in `on_refund_resolved`. The money always goes to the token owner, never the caller.

use crate::constants::*;
use crate::errors::*;
use crate::escrow::ext_ft;
use crate::types::{HajatStatus, InvState};
use crate::{events, Contract, ContractExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, NearToken, Promise};

#[near]
impl Contract {
    /// Host cancels while no envelope is `Opened` or `Opening`.
    /// Sealed envelopes are then refundable by anyone, to their owners.
    pub fn cancel_hajat(&mut self, hajat_id: u64) {
        let mut hajat = self.hajat_or_panic(hajat_id);
        self.require_host(&hajat);
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);

        // bounded by MAX_INVITES
        for idx in 0..hajat.invite_count {
            let Some(token_id) = self.hajat_tokens.get(&(hajat_id, idx)).copied() else {
                continue;
            };
            if let Some(token) = self.tokens.get(&token_id) {
                require!(
                    token.state != InvState::Opened && token.state != InvState::Opening,
                    ERR_HAS_OPENED
                );
            }
        }

        hajat.status = HajatStatus::Cancelled;
        let host = hajat.host.clone();
        self.hajats.insert(hajat_id, hajat);
        events::hajat_cancelled(hajat_id, &host);
    }

    /// Anyone may trigger a refund. Allowed when the hajat is cancelled, or when the
    /// envelope is still sealed 30 days after the event (the host disappeared).
    pub fn refund(&mut self, token_id: u64) -> Promise {
        require!(env::prepaid_gas() >= MIN_GAS_REFUND, ERR_GAS);
        let mut token = self.token_or_panic(token_id);
        let hajat = self.hajat_or_panic(token.hajat_id);
        require!(token.state == InvState::Sealed, ERR_NOT_REFUNDABLE);

        let cancelled = hajat.status == HajatStatus::Cancelled;
        let abandoned = env::block_timestamp_ms() >= hajat.event_at_ms.saturating_add(ABANDON_MS);
        require!(cancelled || abandoned, ERR_NOT_REFUNDABLE);

        let amount = token.sealed;
        let owner = token.owner.clone();
        token.state = InvState::Refunding;
        self.tokens.insert(token_id, token);

        ext_ft::ext(self.ft.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(owner, amount, Some("amplop refund".to_string()))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_refund_resolved(token_id, amount),
            )
    }

    /// Callback of the refund transfer. Must never panic, same as `on_open_resolved`.
    #[private]
    pub fn on_refund_resolved(&mut self, token_id: u64, amount: U128) -> bool {
        let transferred =
            env::promise_results_count() == 1 && env::promise_result_checked(0, 64).is_ok();

        let Some(mut token) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        let Some(mut hajat) = self.hajats.get(&token.hajat_id).cloned() else {
            return false;
        };
        if token.state != InvState::Refunding {
            return false;
        }

        if !transferred {
            token.state = InvState::Sealed;
            events::refund_failed(hajat.id, token_id, &token.owner, amount.0);
            self.tokens.insert(token_id, token);
            return false;
        }

        token.state = InvState::Refunded;
        token.sealed = U128(0);
        hajat.sealed_total = U128(hajat.sealed_total.0.saturating_sub(amount.0));
        events::refunded(hajat.id, token_id, &token.owner, amount.0);
        self.tokens.insert(token_id, token);
        self.hajats.insert(hajat.id, hajat);
        true
    }
}
