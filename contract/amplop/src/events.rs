//! NEP-297 events. Standard name `promise_amplop`, plus NEP-171 `nft_mint`.

use near_sdk::serde_json::{json, Value};
use near_sdk::{log, AccountId};

const STANDARD: &str = "promise_amplop";
const VERSION: &str = "1.0.0";

fn emit(standard: &str, version: &str, event: &str, data: Value) {
    let line = json!({
        "standard": standard,
        "version": version,
        "event": event,
        "data": [data],
    });
    log!("EVENT_JSON:{}", line);
}

pub fn hajat_created(hajat_id: u64, host: &AccountId, event_at_ms: u64) {
    emit(
        STANDARD,
        VERSION,
        "hajat_created",
        json!({
            "hajat_id": hajat_id.to_string(),
            "host": host,
            "event_at_ms": event_at_ms,
        }),
    );
}

pub fn hajat_updated(hajat_id: u64, host: &AccountId) {
    emit(
        STANDARD,
        VERSION,
        "hajat_updated",
        json!({ "hajat_id": hajat_id.to_string(), "host": host }),
    );
}

pub fn invited(hajat_id: u64, token_id: u64, host: &AccountId, guest: &AccountId) {
    emit(
        STANDARD,
        VERSION,
        "invited",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "host": host,
            "guest": guest,
        }),
    );
}

pub fn joined(hajat_id: u64, token_id: u64, host: &AccountId, guest: &AccountId) {
    emit(
        STANDARD,
        VERSION,
        "joined",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "host": host,
            "guest": guest,
        }),
    );
}

pub fn nft_mint(owner: &AccountId, token_id: u64) {
    emit(
        "nep171",
        "1.2.0",
        "nft_mint",
        json!({ "owner_id": owner, "token_ids": [token_id.to_string()] }),
    );
}

pub fn sealed(hajat_id: u64, token_id: u64, guest: &AccountId, amount: u128, total: u128) {
    emit(
        STANDARD,
        VERSION,
        "sealed",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "guest": guest,
            "amount": amount.to_string(),
            "sealed_total": total.to_string(),
        }),
    );
}

pub fn checked_in(hajat_id: u64, token_id: u64, host: &AccountId, guest: &AccountId) {
    emit(
        STANDARD,
        VERSION,
        "checked_in",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "host": host,
            "guest": guest,
        }),
    );
}

pub fn opened(hajat_id: u64, token_id: u64, host: &AccountId, guest: &AccountId, amount: u128) {
    emit(
        STANDARD,
        VERSION,
        "opened",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "host": host,
            "guest": guest,
            "amount": amount.to_string(),
        }),
    );
}

pub fn open_failed(hajat_id: u64, token_id: u64, host: &AccountId, amount: u128) {
    emit(
        STANDARD,
        VERSION,
        "open_failed",
        json!({
            "hajat_id": hajat_id.to_string(),
            "token_id": token_id.to_string(),
            "host": host,
            "amount": amount.to_string(),
        }),
    );
}
