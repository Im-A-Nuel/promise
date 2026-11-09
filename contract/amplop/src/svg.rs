//! The invitation card, drawn inside the contract. docs/CONTRACTS.md section 7.
//!
//! `nft_token` builds this on every call, so a wallet or an explorer shows the current state
//! without trusting any server. Nothing about the image is stored. The output stays under 2 KB
//! even when every user string is the worst case for escaping.

use crate::types::{card_status, CardStatus, Hajat, Invitation};
use near_sdk::base64::{engine::general_purpose::STANDARD, Engine};

pub const MAX_SVG_BYTES: usize = 2048;

const PAPER: &str = "#FBF7F0";
const LINE: &str = "#E6DCCB";
const INK: &str = "#3A2A1A";
const INK_SOFT: &str = "#6B5A48";
const GOLD: &str = "#C9A227";
const GREEN: &str = "#2F6B3F";
const RED: &str = "#9B1C1C";

/// Escapes the five characters that matter inside SVG text and attribute values.
pub fn escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            c if c.is_control() => out.push(' '),
            c => out.push(c),
        }
    }
    out
}

fn truncate(input: &str, max: usize) -> String {
    if input.chars().count() <= max {
        input.to_string()
    } else {
        let mut s: String = input.chars().take(max - 1).collect();
        s.push('\u{2026}');
        s
    }
}

/// tUSDC base units to "5.00": at least two decimals, more only when they are real.
pub fn format_amount(units: u128) -> String {
    let whole = units / 1_000_000;
    let frac = format!("{:06}", units % 1_000_000);
    let mut trimmed = frac.trim_end_matches('0').to_string();
    while trimmed.len() < 2 {
        trimmed.push('0');
    }
    format!("{whole}.{trimmed}")
}

fn stamp(status: CardStatus) -> &'static str {
    match status {
        CardStatus::Invited => "INVITED",
        CardStatus::Sealed => "SEALED",
        CardStatus::Opened => "OPENED",
        CardStatus::PartiallyRepaid => "PART REPAID",
        CardStatus::Repaid => "REPAID",
        CardStatus::Reply => "REPLY",
        CardStatus::Refunded => "RETURNED",
        CardStatus::Void => "CANCELLED",
    }
}

pub fn render_svg(inv: &Invitation, hajat: &Hajat) -> String {
    let status = card_status(inv, hajat);
    let released = inv.released.0;
    let credit = released.saturating_sub(inv.settled.0);

    let stamp_color = match status {
        CardStatus::Repaid | CardStatus::Reply => GREEN,
        CardStatus::Void => INK_SOFT,
        _ => RED,
    };
    let (body, left, floor, dark) = if status == CardStatus::Void {
        ("#9A9A9A", "#8A8A8A", "#A8A8A8", "#7A7A7A")
    } else {
        (RED, "#8A1919", "#A62323", "#7A1414")
    };
    let open = matches!(
        status,
        CardStatus::Invited | CardStatus::Opened | CardStatus::PartiallyRepaid
    );

    let mut s = String::with_capacity(1800);
    s.push_str("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 220'>");
    s.push_str(&format!(
        "<rect x='.5' y='.5' width='359' height='219' rx='16' fill='{PAPER}' stroke='{LINE}'/>"
    ));
    s.push_str(&format!(
        "<text x='24' y='38' font-size='18' font-weight='600' fill='{INK}' font-family='Georgia,serif'>{}</text>",
        escape(&truncate(&inv.label, 16))
    ));
    s.push_str(&format!(
        "<text x='24' y='56' font-size='11' fill='{INK_SOFT}'>{}</text>",
        escape(&truncate(&hajat.title, 28))
    ));
    s.push_str(&format!(
        "<text x='336' y='38' text-anchor='end' font-size='12' fill='{INK_SOFT}'>#{}</text>",
        inv.token_id
    ));
    s.push_str(&format!(
        "<rect x='240' y='46' width='96' height='20' rx='3' fill='none' stroke='{stamp_color}' stroke-width='1.5'/>\
<text x='288' y='60' text-anchor='middle' font-size='10' font-weight='700' fill='{stamp_color}'>{}</text>",
        stamp(status)
    ));

    if status == CardStatus::Refunded {
        s.push_str("<g opacity='.45'>");
    }
    if open {
        s.push_str(&format!(
            "<polygon points='70,96 290,96 180,48' fill='{dark}'/>"
        ));
    }
    s.push_str(&format!(
        "<rect x='70' y='96' width='220' height='96' rx='6' fill='{body}'/>"
    ));
    if open {
        s.push_str("<polygon points='70,96 290,96 180,152' fill='#5E1010'/>");
    }
    s.push_str(&format!(
        "<polygon points='70,96 180,152 70,192' fill='{left}'/>\
<polygon points='290,96 180,152 290,192' fill='{left}'/>\
<polygon points='70,192 180,138 290,192' fill='{floor}'/>"
    ));
    if !open {
        s.push_str(&format!(
            "<polygon points='70,96 290,96 180,160' fill='{dark}'/>"
        ));
    }

    match status {
        CardStatus::Sealed => s.push_str(&format!(
            "<circle cx='180' cy='150' r='16' fill='{GOLD}'/><circle cx='180' cy='150' r='10' fill='none' stroke='{dark}' stroke-width='1.5'/>"
        )),
        CardStatus::Opened | CardStatus::PartiallyRepaid => s.push_str(&format!(
            "<circle cx='180' cy='114' r='23' fill='{GOLD}'/><circle cx='180' cy='114' r='18' fill='none' stroke='{dark}' stroke-width='1' opacity='.5'/>"
        )),
        CardStatus::Repaid => s.push_str(&format!(
            "<circle cx='180' cy='148' r='18' fill='{GREEN}'/><path d='M171 148l7 7 13-14' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/>"
        )),
        CardStatus::Reply => s.push_str(&format!(
            "<circle cx='180' cy='148' r='18' fill='{GREEN}'/><path d='M168 144h20m-5-5l5 5-5 5M192 154h-20m5-5l-5 5 5 5' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>"
        )),
        _ => {}
    }
    if status == CardStatus::Refunded {
        s.push_str("</g>");
    }

    // Footer. The amount stays hidden while the envelope is sealed.
    let footer = match status {
        CardStatus::Opened | CardStatus::PartiallyRepaid | CardStatus::Repaid => {
            Some(format!("{} tUSDC", format_amount(released)))
        }
        CardStatus::Reply => Some(format!("Repaid {} envelope(s)", inv.repays.len())),
        _ => None,
    };
    if let Some(text) = footer {
        s.push_str(&format!(
            "<text x='180' y='213' text-anchor='middle' font-size='12' fill='{INK_SOFT}'>{text}</text>"
        ));
    }
    if status == CardStatus::PartiallyRepaid && credit > 0 {
        // Scale both down first when `* 220` could overflow, so a huge amount can never make
        // `nft_token` panic.
        let paid = inv.reciprocated.0.min(credit);
        let (paid, total) = if credit > u128::MAX / 220 {
            (paid >> 8, (credit >> 8).max(1))
        } else {
            (paid, credit)
        };
        let width = (paid * 220 / total) as u64;
        s.push_str(&format!(
            "<rect x='70' y='196' width='220' height='4' fill='{LINE}'/><rect x='70' y='196' width='{width}' height='4' fill='{GREEN}'/>"
        ));
    }

    s.push_str("</svg>");
    if s.len() >= MAX_SVG_BYTES {
        // Unreachable with the truncation above, kept as a hard guarantee on the size.
        return fallback_card(inv.token_id, stamp(status));
    }
    s
}

/// A minimal card with no user text. Used only if the full card would pass `MAX_SVG_BYTES`.
fn fallback_card(token_id: u64, stamp: &str) -> String {
    format!(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 220'>\
<rect width='360' height='220' rx='16' fill='{PAPER}' stroke='{LINE}'/>\
<text x='180' y='110' text-anchor='middle' font-size='20' fill='{INK}'>#{token_id} {stamp}</text></svg>"
    )
}

/// `data:image/svg+xml;base64,...` for the NEP-177 `media` field.
pub fn data_uri(inv: &Invitation, hajat: &Hajat) -> String {
    format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(render_svg(inv, hajat))
    )
}
