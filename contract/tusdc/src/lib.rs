mod errors;

use errors::{ERR_BAD_INPUT, ERR_COOLDOWN, ERR_NOT_OWNER, ERR_OVERFLOW};
use near_contract_standards::fungible_token::events::FtMint;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::{U128, U64};
use near_sdk::store::LookupMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, PanicOnDefault, PromiseOrValue,
};

/// 100 tUSDC with 6 decimals.
pub const FAUCET_AMOUNT: u128 = 100_000_000;
/// One faucet claim per account per 6 hours, in milliseconds.
pub const FAUCET_COOLDOWN_MS: u64 = 6 * 60 * 60 * 1000;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Token,
    Metadata,
    FaucetClaims,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    owner_id: AccountId,
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    /// account -> earliest ms timestamp of the next faucet claim
    next_claim_at: LookupMap<AccountId, u64>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        require!(!env::state_exists(), "ERR_ALREADY_INITIALIZED");
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Test USDC (Promise)".to_string(),
            symbol: "tUSDC".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        };
        metadata.assert_valid();
        Self {
            owner_id,
            token: FungibleToken::new(StorageKey::Token),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            next_claim_at: LookupMap::new(StorageKey::FaucetClaims),
        }
    }

    /// Mints 100 tUSDC to the caller and registers the caller if needed.
    /// One call per account per 6 hours.
    pub fn faucet(&mut self) -> U128 {
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let next = self.next_claim_at.get(&caller).copied().unwrap_or(0);
        require!(now >= next, ERR_COOLDOWN);
        let next_allowed = now.checked_add(FAUCET_COOLDOWN_MS).unwrap_or(u64::MAX);
        self.next_claim_at.insert(caller.clone(), next_allowed);
        self.mint_to(&caller, FAUCET_AMOUNT, "faucet");
        U128(FAUCET_AMOUNT)
    }

    /// Millisecond timestamp when `account_id` may claim again. 0 means now.
    pub fn faucet_next_at(&self, account_id: AccountId) -> U64 {
        U64(self.next_claim_at.get(&account_id).copied().unwrap_or(0))
    }

    /// Owner only. Used by `seed.ts` to fund personas.
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            ERR_NOT_OWNER
        );
        require!(amount.0 > 0, ERR_BAD_INPUT);
        self.mint_to(&account_id, amount.0, "mint");
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }
}

impl Contract {
    fn mint_to(&mut self, account_id: &AccountId, amount: u128, memo: &str) {
        if !self.token.accounts.contains_key(account_id) {
            self.token.internal_register_account(account_id);
        }
        let supply_ok = self.token.total_supply.checked_add(amount).is_some();
        require!(supply_ok, ERR_OVERFLOW);
        self.token.internal_deposit(account_id, amount);
        FtMint {
            owner_id: account_id,
            amount: U128(amount),
            memo: Some(memo),
        }
        .emit();
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        self.token
            .ft_resolve_transfer(sender_id, receiver_id, amount)
            .0
            .into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<near_sdk::NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap_or_else(|| env::panic_str(ERR_BAD_INPUT))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acct(name: &str) -> AccountId {
        name.parse().unwrap()
    }

    fn ctx(predecessor: &str, now_ms: u64) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(acct(predecessor))
            .block_timestamp(now_ms * 1_000_000);
        b
    }

    fn fresh() -> Contract {
        testing_env!(ctx("owner.testnet", 1_000).build());
        Contract::new(acct("owner.testnet"))
    }

    #[test]
    fn faucet_mints_and_registers() {
        let mut c = fresh();
        testing_env!(ctx("budi.testnet", 1_000).build());
        let got = c.faucet();
        assert_eq!(got.0, FAUCET_AMOUNT);
        assert_eq!(c.ft_balance_of(acct("budi.testnet")).0, FAUCET_AMOUNT);
        assert!(c.storage_balance_of(acct("budi.testnet")).is_some());
        assert_eq!(c.ft_total_supply().0, FAUCET_AMOUNT);
    }

    #[test]
    #[should_panic(expected = "ERR_COOLDOWN")]
    fn faucet_twice_within_cooldown_fails() {
        let mut c = fresh();
        testing_env!(ctx("budi.testnet", 1_000).build());
        c.faucet();
        testing_env!(ctx("budi.testnet", 1_000 + FAUCET_COOLDOWN_MS - 1).build());
        c.faucet();
    }

    #[test]
    fn faucet_again_after_cooldown() {
        let mut c = fresh();
        testing_env!(ctx("budi.testnet", 1_000).build());
        c.faucet();
        assert_eq!(
            c.faucet_next_at(acct("budi.testnet")).0,
            1_000 + FAUCET_COOLDOWN_MS
        );
        testing_env!(ctx("budi.testnet", 1_000 + FAUCET_COOLDOWN_MS).build());
        c.faucet();
        assert_eq!(c.ft_balance_of(acct("budi.testnet")).0, 2 * FAUCET_AMOUNT);
    }

    #[test]
    fn cooldown_is_per_account() {
        let mut c = fresh();
        testing_env!(ctx("budi.testnet", 1_000).build());
        c.faucet();
        testing_env!(ctx("citra.testnet", 1_000).build());
        c.faucet();
        assert_eq!(c.ft_balance_of(acct("citra.testnet")).0, FAUCET_AMOUNT);
    }

    #[test]
    fn owner_can_mint() {
        let mut c = fresh();
        testing_env!(ctx("owner.testnet", 1_000).build());
        c.mint(acct("ayu.testnet"), U128(500_000_000));
        assert_eq!(c.ft_balance_of(acct("ayu.testnet")).0, 500_000_000);
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_OWNER")]
    fn stranger_cannot_mint() {
        let mut c = fresh();
        testing_env!(ctx("budi.testnet", 1_000).build());
        c.mint(acct("budi.testnet"), U128(1));
    }

    #[test]
    fn metadata_is_six_decimals() {
        let c = fresh();
        let m = c.ft_metadata();
        assert_eq!(m.decimals, 6);
        assert_eq!(m.symbol, "tUSDC");
    }
}
