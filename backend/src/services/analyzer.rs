use std::collections::HashSet;

use crate::models::{RiskFlag, RiskSeverity, TokenHolding};
use crate::services::helius::ParsedTransfer;

const KNOWN_SCAM_MINTS: &[&str] = &["ScamTestMintDoNotUse11111111111111111111"];
const LOOKALIKE_PREFIX: usize = 4;
const LOOKALIKE_SUFFIX: usize = 4;
const NATIVE_DUST_SOL: f64 = 0.01;
const TOKEN_DUST_AMOUNT: f64 = 1.0;
const MAX_POISONING_FLAGS: usize = 5;

pub fn analyze_risks(tokens: &[TokenHolding]) -> Vec<RiskFlag> {
    analyze(tokens).0
}

pub fn analyze(tokens: &[TokenHolding]) -> (Vec<RiskFlag>, u8) {
    let mut flags = Vec::new();
    let unverified: Vec<&TokenHolding> = tokens.iter().filter(|t| !t.verified).collect();

    for token in tokens {
        if KNOWN_SCAM_MINTS.contains(&token.mint.as_str()) {
            flags.push(RiskFlag {
                flag_type: "known_scam".to_string(),
                severity: RiskSeverity::High,
                message: format!("Token {} matches a known scam mint", token.mint),
            });
        }
    }

    if unverified.len() > 15 {
        flags.push(RiskFlag {
            flag_type: "unverified_flood".to_string(),
            severity: RiskSeverity::High,
            message: format!("Wallet holds {} unverified tokens", unverified.len()),
        });
    } else if unverified.len() > 5 {
        flags.push(RiskFlag {
            flag_type: "unverified_flood".to_string(),
            severity: RiskSeverity::Medium,
            message: format!("Wallet holds {} unverified tokens", unverified.len()),
        });
    }

    let dust_count = unverified.iter().filter(|t| t.amount < 1.0).count();
    if dust_count >= 10 {
        flags.push(RiskFlag {
            flag_type: "dust_tokens".to_string(),
            severity: RiskSeverity::Medium,
            message: format!("Found {dust_count} dust-amount unverified tokens"),
        });
    } else if dust_count >= 3 {
        flags.push(RiskFlag {
            flag_type: "dust_tokens".to_string(),
            severity: RiskSeverity::Low,
            message: format!("Found {dust_count} dust-amount unverified tokens"),
        });
    }

    for token in &unverified {
        if token.amount > 1_000_000.0 {
            flags.push(RiskFlag {
                flag_type: "spam_token".to_string(),
                severity: RiskSeverity::High,
                message: format!(
                    "Unverified token {} has suspiciously high amount {}",
                    token.mint, token.amount
                ),
            });
        } else if token.amount > 1000.0 {
            flags.push(RiskFlag {
                flag_type: "spam_token".to_string(),
                severity: RiskSeverity::Medium,
                message: format!(
                    "Unverified token {} has suspiciously high amount {}",
                    token.mint, token.amount
                ),
            });
        }
    }

    if tokens.len() >= 5 {
        let ratio = unverified.len() as f64 / tokens.len() as f64;
        if ratio >= 0.8 {
            flags.push(RiskFlag {
                flag_type: "unverified_majority".to_string(),
                severity: RiskSeverity::Medium,
                message: format!(
                    "{:.0}% of holdings are unverified ({}/{})",
                    ratio * 100.0,
                    unverified.len(),
                    tokens.len()
                ),
            });
        }
    }

    let score = risk_score(&flags);
    (flags, score)
}

/// Dust from a sender whose address looks like *this wallet* (truncated-address scam).
pub fn address_poisoning_flags(wallet: &str, transfers: &[ParsedTransfer]) -> Vec<RiskFlag> {
    let mut seen: HashSet<&str> = HashSet::new();
    let mut flags = Vec::new();

    for transfer in transfers {
        if transfer.to != wallet || transfer.from == wallet || !is_dust(transfer) {
            continue;
        }
        let sender = transfer.from.as_str();
        if !is_lookalike(sender, wallet) {
            continue;
        }
        if !seen.insert(sender) {
            continue;
        }
        flags.push(RiskFlag {
            flag_type: "address_poisoning".to_string(),
            severity: RiskSeverity::High,
            message: format!(
                "Incoming dust from {sender} mimics this wallet {wallet}. Attackers send tiny amounts from lookalike addresses hoping you copy the wrong one."
            ),
        });
        if flags.len() >= MAX_POISONING_FLAGS {
            break;
        }
    }

    flags
}

pub(crate) fn risk_score(flags: &[RiskFlag]) -> u8 {
    let raw: u32 = flags
        .iter()
        .map(|flag| match flag.severity {
            RiskSeverity::Low => 8,
            RiskSeverity::Medium => 18,
            RiskSeverity::High => 40,
        })
        .sum();
    raw.min(100) as u8
}

fn is_dust(transfer: &ParsedTransfer) -> bool {
    if transfer.amount_ui <= 0.0 {
        return false;
    }
    if transfer.is_native {
        transfer.amount_ui < NATIVE_DUST_SOL
    } else {
        transfer.amount_ui < TOKEN_DUST_AMOUNT
    }
}

/// Same first/last characters as a truncated address, but not the same wallet.
pub(crate) fn is_lookalike(left: &str, right: &str) -> bool {
    if left == right {
        return false;
    }
    let min_len = LOOKALIKE_PREFIX + LOOKALIKE_SUFFIX;
    if left.len() < min_len || right.len() < min_len {
        return false;
    }
    left.as_bytes()[..LOOKALIKE_PREFIX] == right.as_bytes()[..LOOKALIKE_PREFIX]
        && left.as_bytes()[left.len() - LOOKALIKE_SUFFIX..]
            == right.as_bytes()[right.len() - LOOKALIKE_SUFFIX..]
}

#[cfg(test)]
mod tests {
    use super::{address_poisoning_flags, analyze, is_lookalike};
    use crate::models::{RiskSeverity, TokenHolding};
    use crate::services::helius::ParsedTransfer;

    fn holding(mint: &str, amount: f64, verified: bool) -> TokenHolding {
        TokenHolding {
            mint: mint.to_string(),
            amount,
            verified,
            symbol: None,
        }
    }

    #[test]
    fn no_flags_on_clean_wallet() {
        let tokens = vec![holding("mint-a", 10.0, true)];
        let (flags, score) = analyze(&tokens);
        assert!(flags.is_empty());
        assert_eq!(score, 0);
    }

    #[test]
    fn dust_tokens_low() {
        let tokens = vec![
            holding("u1", 0.1, false),
            holding("u2", 0.2, false),
            holding("u3", 0.3, false),
        ];
        let (flags, _) = analyze(&tokens);
        assert!(flags.iter().any(|f| f.flag_type == "dust_tokens"));
        assert_eq!(
            flags
                .iter()
                .find(|f| f.flag_type == "dust_tokens")
                .unwrap()
                .severity,
            RiskSeverity::Low
        );
    }

    #[test]
    fn unverified_flood_medium_and_high() {
        let medium: Vec<_> = (0..7)
            .map(|i| holding(&format!("m{i}"), 2.0, false))
            .collect();
        let (flags, _) = analyze(&medium);
        let flood = flags
            .iter()
            .find(|f| f.flag_type == "unverified_flood")
            .unwrap();
        assert_eq!(flood.severity, RiskSeverity::Medium);

        let high: Vec<_> = (0..16)
            .map(|i| holding(&format!("h{i}"), 2.0, false))
            .collect();
        let (flags, score) = analyze(&high);
        let flood = flags
            .iter()
            .find(|f| f.flag_type == "unverified_flood")
            .unwrap();
        assert_eq!(flood.severity, RiskSeverity::High);
        assert!(score > 0);
    }

    #[test]
    fn spam_token_emits_high_for_huge_amount() {
        let tokens = vec![holding("spam", 2_000_000.0, false)];
        let (flags, _) = analyze(&tokens);
        let spam = flags.iter().find(|f| f.flag_type == "spam_token").unwrap();
        assert_eq!(spam.severity, RiskSeverity::High);
    }

    #[test]
    fn unverified_majority() {
        let tokens = vec![
            holding("v", 1.0, true),
            holding("u1", 2.0, false),
            holding("u2", 2.0, false),
            holding("u3", 2.0, false),
            holding("u4", 2.0, false),
        ];
        let (flags, _) = analyze(&tokens);
        assert!(flags.iter().any(|f| f.flag_type == "unverified_majority"));
    }

    #[test]
    fn known_scam_is_high() {
        let tokens = vec![holding(
            "ScamTestMintDoNotUse11111111111111111111",
            1.0,
            true,
        )];
        let (flags, _) = analyze(&tokens);
        let flag = flags.iter().find(|f| f.flag_type == "known_scam").unwrap();
        assert_eq!(flag.severity, RiskSeverity::High);
    }

    fn native(from: &str, to: &str, sol: f64) -> ParsedTransfer {
        ParsedTransfer {
            from: from.to_string(),
            to: to.to_string(),
            amount_ui: sol,
            is_native: true,
        }
    }

    #[test]
    fn lookalike_matches_prefix_and_suffix() {
        let real = "87pQXFpEFuiA9bpJf7E1CrJLAxbepCEnZ95u8ypaRPVG";
        let fake = "87pQAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaaaaRPVG";
        assert!(is_lookalike(real, fake));
        assert!(!is_lookalike(real, real));
    }

    #[test]
    fn flags_dust_from_lookalike_of_this_wallet() {
        let wallet = "87pQXFpEFuiA9bpJf7E1CrJLAxbepCEnZ95u8ypaRPVG";
        let fake = "87pQAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaaaaRPVG";
        let flags = address_poisoning_flags(wallet, &[native(fake, wallet, 0.001)]);
        assert_eq!(flags.len(), 1);
        assert_eq!(flags[0].flag_type, "address_poisoning");
        assert_eq!(flags[0].severity, RiskSeverity::High);
        assert!(flags[0].message.contains(wallet));
        assert!(flags[0].message.contains(fake));
    }

    #[test]
    fn ignores_dust_from_lookalike_of_someone_else() {
        let wallet = "87pQXFpEFuiA9bpJf7E1CrJLAxbepCEnZ95u8ypaRPVG";
        let other = "DxuZ1111111111111111111111111111111111TWz9";
        let other_lookalike = "DxuZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATWz9";
        let flags = address_poisoning_flags(
            wallet,
            &[
                native(wallet, other, 1.5),
                native(other_lookalike, wallet, 0.001),
            ],
        );
        assert!(flags.is_empty());
    }

    #[test]
    fn ignores_dust_from_unrelated_address() {
        let wallet = "87pQXFpEFuiA9bpJf7E1CrJLAxbepCEnZ95u8ypaRPVG";
        let other = "Other1111111111111111111111111111111111111";
        let flags = address_poisoning_flags(wallet, &[native(other, wallet, 0.001)]);
        assert!(flags.is_empty());
    }

    #[test]
    fn ignores_large_incoming_from_wallet_lookalike() {
        let wallet = "87pQXFpEFuiA9bpJf7E1CrJLAxbepCEnZ95u8ypaRPVG";
        let fake = "87pQAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaaaaRPVG";
        let flags = address_poisoning_flags(wallet, &[native(fake, wallet, 2.0)]);
        assert!(flags.is_empty());
    }
}
