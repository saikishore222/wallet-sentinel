use std::collections::{HashMap, HashSet};

use anyhow::{Context, Result, bail};
use reqwest::Client;
use serde::Deserialize;

/// Jupiter Tokens API V2 — verified list (successor to deprecated token.jup.ag/strict).
const JUPITER_VERIFIED_TOKENS_URL: &str = "https://api.jup.ag/tokens/v2/tag?query=verified";

#[derive(Clone, Default)]
pub struct VerifiedTokenIndex {
    pub mints: HashSet<String>,
    pub symbols: HashMap<String, String>,
}

#[derive(Deserialize)]
struct JupiterToken {
    /// Legacy strict list used `address`; Tokens API V2 uses `id`.
    #[serde(alias = "id")]
    address: String,
    symbol: Option<String>,
}

/// Fetch Jupiter's verified mint set (strict-list equivalent) plus symbols.
pub async fn get_verified_tokens(
    client: &Client,
    api_key: Option<&str>,
) -> Result<VerifiedTokenIndex> {
    let mut request = client.get(JUPITER_VERIFIED_TOKENS_URL);
    if let Some(key) = api_key.filter(|k| !k.is_empty()) {
        request = request.header("x-api-key", key);
    }

    let response = crate::http_util::send_with_retry(request, 2)
        .await
        .context("failed to fetch Jupiter verified token list")?;

    let status = response.status();
    if !status.is_success() {
        bail!("Jupiter token list returned HTTP {status}");
    }

    let tokens: Vec<JupiterToken> = response
        .json()
        .await
        .with_context(|| format!("failed to parse Jupiter token list (HTTP {status})"))?;

    let mut index = VerifiedTokenIndex::default();
    for token in tokens {
        if let Some(symbol) = token.symbol.filter(|s| !s.is_empty()) {
            index.symbols.insert(token.address.clone(), symbol);
        }
        index.mints.insert(token.address);
    }
    Ok(index)
}
