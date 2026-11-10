//! Card renderer tests: T-29 (every status draws valid SVG) and T-30 (escaping and size).

use super::escrow::*;
use super::*;
use crate::svg::{escape, format_amount, render_svg, MAX_SVG_BYTES};
use near_sdk::base64::{engine::general_purpose::STANDARD, Engine};

const UNIT: u128 = 1_000_000;

/// Every card status as (name, invitation, hajat), built from the same table as `card_status_table`.
fn all_statuses() -> Vec<(&'static str, Invitation, Hajat)> {
    let open = hajat_with(HajatStatus::Open);
    let cancelled = hajat_with(HajatStatus::Cancelled);
    let mut reply = sample(InvState::Opened, 5 * UNIT, 5 * UNIT, 0);
    reply.repays = vec![(1, U128(5 * UNIT))];
    vec![
        ("Invited", sample(InvState::Invited, 0, 0, 0), open.clone()),
        ("Sealed", sample(InvState::Sealed, 0, 0, 0), open.clone()),
        (
            "Opened",
            sample(InvState::Opened, 5 * UNIT, 0, 0),
            open.clone(),
        ),
        (
            "PartiallyRepaid",
            sample(InvState::Opened, 5 * UNIT, 0, 3 * UNIT),
            open.clone(),
        ),
        (
            "Repaid",
            sample(InvState::Opened, 5 * UNIT, 0, 5 * UNIT),
            open.clone(),
        ),
        ("Reply", reply, open.clone()),
        ("Refunded", sample(InvState::Refunded, 0, 0, 0), open),
        ("Void", sample(InvState::Invited, 0, 0, 0), cancelled),
    ]
}

/// A small well-formedness check: tags balance, every `&` starts a known entity, quotes pair up,
/// and no raw `<` or `>` hides in text.
fn assert_well_formed(svg: &str) {
    assert!(svg.starts_with("<svg ") && svg.ends_with("</svg>"), "{svg}");
    let mut stack: Vec<String> = Vec::new();
    let mut rest = svg;
    while let Some(start) = rest.find('<') {
        let text = &rest[..start];
        assert!(!text.contains('>'), "raw > in text: {text}");
        let end = rest[start..].find('>').expect("unterminated tag") + start;
        let tag = &rest[start + 1..end];
        assert!(!tag.contains('<'), "raw < inside tag: {tag}");
        assert_eq!(tag.matches('\'').count() % 2, 0, "unbalanced quotes: {tag}");
        if let Some(name) = tag.strip_prefix('/') {
            assert_eq!(stack.pop().as_deref(), Some(name), "closing {name}");
        } else if !tag.ends_with('/') {
            stack.push(tag.split_whitespace().next().unwrap().to_string());
        }
        rest = &rest[end + 1..];
    }
    assert!(stack.is_empty(), "unclosed: {stack:?}");
    for (i, _) in svg.match_indices('&') {
        let tail = &svg[i..];
        assert!(
            ["&amp;", "&lt;", "&gt;", "&quot;", "&apos;"]
                .iter()
                .any(|e| tail.starts_with(e)),
            "bare & at {i}: {}",
            &tail[..tail.len().min(12)]
        );
    }
}

// T-29
#[test]
fn t29_every_status_draws_a_valid_svg_under_2kb() {
    for (name, inv, hajat) in all_statuses() {
        let svg = render_svg(&inv, &hajat);
        assert_well_formed(&svg);
        assert!(svg.len() < MAX_SVG_BYTES, "{name}: {} bytes", svg.len());
        assert!(svg.contains("viewBox='0 0 360 220'"), "{name}");
    }
}

#[test]
fn each_status_has_its_own_stamp() {
    let expected = [
        ("Invited", "INVITED"),
        ("Sealed", "SEALED"),
        ("Opened", "OPENED"),
        ("PartiallyRepaid", "PART REPAID"),
        ("Repaid", "REPAID"),
        ("Reply", "REPLY"),
        ("Refunded", "RETURNED"),
        ("Void", "CANCELLED"),
    ];
    let cards = all_statuses();
    let mut seen = std::collections::HashSet::new();
    for ((name, inv, hajat), (n2, word)) in cards.iter().zip(expected) {
        assert_eq!(*name, n2);
        let svg = render_svg(inv, hajat);
        assert!(
            svg.contains(&format!(">{word}</text>")),
            "{name} lacks {word}"
        );
        assert!(seen.insert(svg), "{name} looks identical to another status");
    }
}

#[test]
fn amount_is_hidden_while_sealed_and_shown_after() {
    let open = hajat_with(HajatStatus::Open);
    let mut sealed = sample(InvState::Sealed, 0, 0, 0);
    sealed.sealed = U128(7 * UNIT);
    let svg = render_svg(&sealed, &open);
    assert!(!svg.contains("7.00") && !svg.contains("7000000"), "{svg}");
    assert!(!svg.contains("tUSDC"));

    let opened = render_svg(&sample(InvState::Opened, 5 * UNIT, 0, 0), &open);
    assert!(opened.contains("5.00 tUSDC"));
    let reply = &all_statuses()[5];
    assert!(render_svg(&reply.1, &reply.2).contains("Repaid 1 envelope(s)"));
}

#[test]
fn partial_progress_bar_tracks_reciprocated_over_credit() {
    let open = hajat_with(HajatStatus::Open);
    // credit 8, settled 3 earlier, 2 paid back: bar is 2/5 of 220 = 88
    let inv = sample(InvState::Opened, 8 * UNIT, 3 * UNIT, 2 * UNIT);
    let svg = render_svg(&inv, &open);
    assert!(svg.contains("width='88' height='4'"), "{svg}");
}

// T-30
#[test]
fn t30_user_strings_are_escaped() {
    let mut inv = sample(InvState::Sealed, 0, 0, 0);
    inv.label = "<script>alert('x')</script>".into();
    let mut hajat = hajat_with(HajatStatus::Open);
    hajat.title = "A & B \"party\" </text><rect/>".into();
    let svg = render_svg(&inv, &hajat);
    assert!(!svg.contains("<script"), "{svg}");
    assert!(!svg.contains("</text><rect/>"), "{svg}");
    assert!(svg.contains("&lt;script&gt;"));
    assert!(svg.contains("A &amp; B &quot;party&quot;"));
    assert_well_formed(&svg);
}

#[test]
fn t30_worst_case_input_stays_under_2kb_for_every_status() {
    for (name, mut inv, mut hajat) in all_statuses() {
        // 40 chars of the character that grows the most when escaped
        inv.label = "'".repeat(40);
        hajat.title = "'".repeat(80);
        inv.released = U128(u128::MAX / 2);
        inv.settled = U128(0);
        inv.reciprocated = U128(u128::MAX / 4);
        inv.token_id = u64::MAX;
        inv.repays = vec![(1, U128(1)); 30];
        let svg = render_svg(&inv, &hajat);
        assert!(svg.len() < MAX_SVG_BYTES, "{name}: {} bytes", svg.len());
        assert_well_formed(&svg);
    }
}

#[test]
fn control_characters_cannot_break_the_markup() {
    assert_eq!(escape("a\nb\u{0}c"), "a b c");
    assert_eq!(escape("&<>\"'"), "&amp;&lt;&gt;&quot;&apos;");
}

#[test]
fn long_text_is_truncated_with_an_ellipsis() {
    let mut inv = sample(InvState::Invited, 0, 0, 0);
    inv.label = "abcdefghijklmnopqrstuvwxyz".into();
    let mut hajat = hajat_with(HajatStatus::Open);
    hajat.title = "x".repeat(60);
    let svg = render_svg(&inv, &hajat);
    assert!(svg.contains("abcdefghijklmno\u{2026}"));
    assert!(svg.contains(&format!("{}\u{2026}", "x".repeat(27))));
    assert!(
        !svg.contains("xxxxxxxxxxxxxxxxxxxxxxxxxxxx<"),
        "28 x then end would not be truncated"
    );
}

#[test]
fn format_amount_matches_the_web_formatter() {
    assert_eq!(format_amount(5_000_000), "5.00");
    assert_eq!(format_amount(10_000), "0.01");
    assert_eq!(format_amount(5_120_000), "5.12");
    assert_eq!(format_amount(5_123_456), "5.123456");
    assert_eq!(format_amount(0), "0.00");
}

#[test]
fn nft_token_media_is_the_card_as_a_data_uri() {
    let (mut c, _h, t) = setup_open_window();
    seal(&mut c, t, 5 * UNIT);
    let tok = c.nft_token(t.to_string()).unwrap();
    let media = tok.metadata.media.unwrap();
    let b64 = media
        .strip_prefix("data:image/svg+xml;base64,")
        .expect("data uri");
    let svg = String::from_utf8(STANDARD.decode(b64).unwrap()).unwrap();
    assert_well_formed(&svg);
    assert!(svg.contains(">SEALED</text>"));
    assert!(
        svg.contains("budi.testnet") || svg.contains("budi"),
        "label is on the card"
    );
    // the card tracks state: after opening it shows the amount
    testing_env!(ctx_at("ayu.testnet", NOW_MS, 0, gas150()).build());
    let _ = c.open(t);
    with_result(
        ctx_at(AMPLOP, NOW_MS, 0, near_sdk::Gas::from_tgas(60)).build(),
        near_sdk::PromiseResult::Successful(vec![]),
    );
    assert!(c.on_open_resolved(t, U128(5 * UNIT)));
    let after = c.nft_token(t.to_string()).unwrap().metadata.media.unwrap();
    let svg2 = String::from_utf8(
        STANDARD
            .decode(after.strip_prefix("data:image/svg+xml;base64,").unwrap())
            .unwrap(),
    )
    .unwrap();
    assert!(svg2.contains("5.00 tUSDC") && svg2.contains(">OPENED</text>"));
}
