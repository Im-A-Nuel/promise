//! Escrow: sealing tUSDC into an invitation and releasing it to the host.
//!
//! Money moves in two phases. The token is locked as `Opening`, `ft_transfer` runs,
//! and `on_open_resolved` finishes. Nothing is marked `Opened` before the transfer succeeds.

use crate::constants::*;
use crate::errors::*;
use crate::types::{HajatStatus, InvState, Invitation};
use crate::{events, Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json;
use near_sdk::{env, log, near, require, AccountId, NearToken, PromiseOrValue};

#[allow(dead_code)]
#[near_sdk::ext_contract(ext_ft)]
pub trait FtContract {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

/// `msg` of `ft_transfer_call`: `{"token_id":"7","note":"optional"}`.
#[near(serializers=[json])]
struct SealMsg {
    token_id: U64,
    note: Option<String>,
}

/// Soft rejection: log the code and return the whole amount so the token contract refunds it.
fn reject(code: &str, amount: U128) -> PromiseOrValue<U128> {
    log!("{}", code);
    PromiseOrValue::Value(amount)
}

#[near]
impl Contract {
    /// NEP-141 receiver hook. Called by `ft` during `ft_transfer_call`.
    /// Returns the unused amount; `U128(0)` means everything was sealed.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.ft, ERR_WRONG_TOKEN);

        let Ok(parsed) = serde_json::from_str::<SealMsg>(&msg) else {
            return reject(ERR_BAD_MSG, amount);
        };
        if let Some(note) = &parsed.note {
            if note.chars().count() > MAX_NOTE {
                return reject(ERR_BAD_MSG, amount);
            }
        }
        let token_id = parsed.token_id.0;
        let Some(mut token) = self.tokens.get(&token_id).cloned() else {
            return reject(ERR_TOKEN_NOT_FOUND, amount);
        };
        let Some(mut hajat) = self.hajats.get(&token.hajat_id).cloned() else {
            return reject(ERR_HAJAT_NOT_FOUND, amount);
        };

        if sender_id != token.owner {
            return reject(ERR_NOT_SENDER_OWNER, amount);
        }
        if hajat.status != HajatStatus::Open {
            return reject(ERR_HAJAT_NOT_OPEN, amount);
        }
        if token.state != InvState::Invited && token.state != InvState::Sealed {
            return reject(ERR_BAD_STATE, amount);
        }
        let now = env::block_timestamp_ms();
        if now >= hajat.event_at_ms.saturating_add(SEAL_UNTIL_MS) {
            return reject(ERR_TOO_LATE, amount);
        }
        if amount.0 < MIN_AMPLOP {
            return reject(ERR_TOO_SMALL, amount);
        }
        // Sealing grows storage that the contract pays for. Hand the tokens back when it is low.
        if self.spare_balance() < MIN_SPARE_BALANCE {
            return reject(ERR_LOW_BALANCE, amount);
        }
        let (Some(sealed), Some(sealed_total)) = (
            token.sealed.0.checked_add(amount.0),
            hajat.sealed_total.0.checked_add(amount.0),
        ) else {
            return reject(ERR_OVERFLOW, amount);
        };

        token.sealed = U128(sealed);
        token.state = InvState::Sealed;
        if token.sealed_at_ms.is_none() {
            token.sealed_at_ms = Some(now);
        }
        if let Some(note) = parsed.note {
            token.note = note;
        }
        hajat.sealed_total = U128(sealed_total);

        events::sealed(hajat.id, token_id, &token.owner, amount.0, sealed);
        self.tokens.insert(token_id, token);
        self.hajats.insert(hajat.id, hajat);
        PromiseOrValue::Value(U128(0))
    }

    /// Host marks a guest as present. If the guest sealed an envelope it is opened too.
    /// On an `Invited` token only attendance is recorded and no money moves.
    pub fn check_in(&mut self, token_id: u64) -> PromiseOrValue<()> {
        require_gas();
        let mut token = self.token_or_panic(token_id);
        let hajat = self.hajat_or_panic(token.hajat_id);
        self.require_host(&hajat);
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);
        require!(
            env::block_timestamp_ms() >= hajat.event_at_ms.saturating_sub(OPEN_WINDOW_MS),
            ERR_TOO_EARLY
        );
        require!(
            token.state == InvState::Invited || token.state == InvState::Sealed,
            ERR_BAD_STATE
        );

        token.checked_in = true;
        let is_sealed = token.state == InvState::Sealed;
        events::checked_in(hajat.id, token_id, &hajat.host, &token.owner);
        self.tokens.insert(token_id, token);

        if is_sealed {
            PromiseOrValue::Promise(self.start_open(token_id))
        } else {
            PromiseOrValue::Value(())
        }
    }

    /// Opens a sealed envelope. The host may from `event_at - 24h`, anyone after `event_at + 24h`.
    pub fn open(&mut self, token_id: u64) -> near_sdk::Promise {
        require_gas();
        let token = self.token_or_panic(token_id);
        let hajat = self.hajat_or_panic(token.hajat_id);
        require!(hajat.status == HajatStatus::Open, ERR_HAJAT_NOT_OPEN);
        require!(token.state == InvState::Sealed, ERR_BAD_STATE);

        let now = env::block_timestamp_ms();
        let earliest = if env::predecessor_account_id() == hajat.host {
            hajat.event_at_ms.saturating_sub(OPEN_WINDOW_MS)
        } else {
            hajat.event_at_ms.saturating_add(AUTO_OPEN_MS)
        };
        require!(now >= earliest, ERR_TOO_EARLY);
        self.start_open(token_id)
    }

    /// Callback of the FT transfer started by `start_open`.
    /// Must never panic: a panic here would leave the token stuck in `Opening`.
    #[private]
    pub fn on_open_resolved(&mut self, token_id: u64, amount: U128) -> bool {
        let transferred =
            env::promise_results_count() == 1 && env::promise_result_checked(0, 64).is_ok();

        let Some(mut token) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        let Some(mut hajat) = self.hajats.get(&token.hajat_id).cloned() else {
            return false;
        };
        if token.state != InvState::Opening {
            return false;
        }

        if !transferred {
            token.state = InvState::Sealed;
            events::open_failed(hajat.id, token_id, &hajat.host, amount.0);
            self.tokens.insert(token_id, token);
            return false;
        }

        token.state = InvState::Opened;
        token.released = amount;
        token.sealed = U128(0);
        token.opened_at_ms = Some(env::block_timestamp_ms());
        hajat.sealed_total = U128(hajat.sealed_total.0.saturating_sub(amount.0));
        hajat.released_total = U128(hajat.released_total.0.saturating_add(amount.0));
        let repays = self.settle(&mut token, &hajat.host);
        events::opened(hajat.id, token_id, &hajat.host, &token.owner, amount.0);
        for (older_id, paid) in repays {
            events::repaid(
                hajat.id,
                token_id,
                older_id,
                &token.owner,
                &hajat.host,
                paid,
            );
        }
        self.tokens.insert(token_id, token);
        self.hajats.insert(hajat.id, hajat);
        true
    }
}

impl Contract {
    pub(crate) fn token_or_panic(&self, token_id: u64) -> Invitation {
        match self.tokens.get(&token_id) {
            Some(t) => t.clone(),
            None => env::panic_str(ERR_TOKEN_NOT_FOUND),
        }
    }

    /// Locks the token and starts the FT transfer to the host. The callback finishes the job.
    fn start_open(&mut self, token_id: u64) -> near_sdk::Promise {
        // The callback adds ledger entries that this account pays for. Refuse before any money
        // moves, because a callback that cannot pay would leave the token stuck in Opening.
        require!(self.spare_balance() >= MIN_SPARE_BALANCE, ERR_LOW_BALANCE);
        let mut token = self.token_or_panic(token_id);
        let hajat = self.hajat_or_panic(token.hajat_id);
        let amount = token.sealed;
        token.state = InvState::Opening;
        self.tokens.insert(token_id, token);

        ext_ft::ext(self.ft.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(hajat.host, amount, Some("amplop".to_string()))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK_OPEN)
                    .on_open_resolved(token_id, amount),
            )
    }
}

fn require_gas() {
    require!(env::prepaid_gas() >= MIN_GAS_OPEN, ERR_GAS);
}
