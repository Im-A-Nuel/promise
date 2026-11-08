//! Promise `amplop` contract. Spec: docs/CONTRACTS.md.

mod errors;

use near_sdk::{env, near, require, AccountId, PanicOnDefault};

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    owner: AccountId,
    ft: AccountId,
    app_url: String,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, ft_id: AccountId, app_url: String) -> Self {
        require!(!env::state_exists(), errors::ERR_BAD_INPUT);
        require!(app_url.len() <= 120, errors::ERR_BAD_INPUT);
        Self {
            owner: owner_id,
            ft: ft_id,
            app_url,
        }
    }

    pub fn get_config(&self) -> (AccountId, AccountId, String) {
        (self.owner.clone(), self.ft.clone(), self.app_url.clone())
    }
}
