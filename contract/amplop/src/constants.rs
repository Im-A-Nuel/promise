//! Limits from docs/CONTRACTS.md section 2.

use near_sdk::Gas;

pub const MAX_TITLE: usize = 80;
pub const MAX_VENUE: usize = 80;
pub const MAX_LABEL: usize = 40;
pub const MAX_APP_URL: usize = 120;
pub const MAX_INVITES: u32 = 200;
pub const MAX_INVITE_BATCH: usize = 20;
pub const MAX_PAGE: u32 = 50;
pub const DEFAULT_PAGE: u32 = 50;
/// Event date at most 365 days ahead, in milliseconds.
pub const MAX_EVENT_AHEAD_MS: u64 = 31_536_000_000;
pub const MAX_NOTE: usize = 140;
/// 0.01 tUSDC with 6 decimals.
pub const MIN_AMPLOP: u128 = 10_000;
/// Host may check in or open from `event_at - 24h`.
pub const OPEN_WINDOW_MS: u64 = 86_400_000;
/// Anyone may open after `event_at + 24h`.
pub const AUTO_OPEN_MS: u64 = 86_400_000;
/// Sealing is allowed until `event_at + 24h`, the same moment auto-open starts.
pub const SEAL_UNTIL_MS: u64 = 86_400_000;
pub const GAS_FT_TRANSFER: Gas = Gas::from_tgas(30);
pub const GAS_CALLBACK: Gas = Gas::from_tgas(25);
pub const MIN_GAS_OPEN: Gas = Gas::from_tgas(120);
