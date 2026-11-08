//! Limits from docs/CONTRACTS.md section 2.

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
