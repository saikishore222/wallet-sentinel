use anyhow::{Context, Result, anyhow};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

const LAMPORTS_PER_SOL: f64 = 1_000_000_000.0;
const TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

#[derive(Deserialize)]
struct RpcError {
    #[serde(default)]
    code: i64,
    message: String,
}

#[derive(Deserialize)]
struct BalanceRpcResponse {
    result: Option<BalanceResult>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct BalanceResult {
    value: u64,
}

/// Parsed SPL token account from Helius `getTokenAccountsByOwner` (jsonParsed).
#[derive(Debug, Clone)]
pub struct RawTokenAccount {
    pub mint: String,
    pub amount: f64,
}

#[derive(Deserialize)]
struct TokenAccountsRpcResponse {
    result: Option<TokenAccountsResult>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct TokenAccountsResult {
    value: Vec<TokenAccountEntry>,
}

#[derive(Deserialize)]
struct TokenAccountEntry {
    account: TokenAccountBody,
}

#[derive(Deserialize)]
struct TokenAccountBody {
    data: TokenAccountData,
}

#[derive(Deserialize)]
struct TokenAccountData {
    parsed: TokenAccountParsed,
}

#[derive(Deserialize)]
struct TokenAccountParsed {
    info: TokenAccountInfo,
}

#[derive(Deserialize)]
struct TokenAccountInfo {
    mint: String,
    #[serde(rename = "tokenAmount")]
    token_amount: TokenAmount,
}

#[derive(Deserialize)]
struct TokenAmount {
    #[serde(rename = "uiAmount")]
    ui_amount: Option<f64>,
}

/// Fetch a wallet's SOL balance via Helius Solana RPC (`getBalance`).
pub async fn get_sol_balance(client: &Client, api_key: &str, address: &str) -> Result<f64> {
    let url = format!("https://mainnet.helius-rpc.com/?api-key={api_key}");

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [address],
    });

    let request = client.post(&url).json(&body);
    let response = crate::http_util::send_with_retry(request, 2)
        .await
        .context("failed to call Helius getBalance")?;

    let status = response.status();
    let rpc: BalanceRpcResponse = response
        .json()
        .await
        .with_context(|| format!("failed to parse Helius response (HTTP {status})"))?;

    if let Some(error) = rpc.error {
        return Err(anyhow!("Helius RPC error: {}", error.message));
    }

    let lamports = rpc
        .result
        .map(|r| r.value)
        .ok_or_else(|| anyhow!("Helius RPC response missing result"))?;

    Ok(lamports as f64 / LAMPORTS_PER_SOL)
}

/// Fetch a wallet's SPL + Token-2022 accounts via Helius (`getTokenAccountsByOwner`).
///
/// Empty/zero-balance accounts are filtered out.
pub async fn get_token_accounts(
    client: &Client,
    api_key: &str,
    address: &str,
) -> Result<Vec<RawTokenAccount>> {
    let (classic, token_2022) = tokio::join!(
        get_token_accounts_for_program(client, api_key, address, TOKEN_PROGRAM_ID),
        get_token_accounts_for_program(client, api_key, address, TOKEN_2022_PROGRAM_ID),
    );

    let mut tokens = classic?;
    tokens.extend(token_2022?);
    Ok(tokens)
}

async fn get_token_accounts_for_program(
    client: &Client,
    api_key: &str,
    address: &str,
    program_id: &str,
) -> Result<Vec<RawTokenAccount>> {
    let url = format!("https://mainnet.helius-rpc.com/?api-key={api_key}");

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [
            address,
            { "programId": program_id },
            { "encoding": "jsonParsed" },
        ],
    });

    let request = client.post(&url).json(&body);
    let response = crate::http_util::send_with_retry(request, 2)
        .await
        .context("failed to call Helius getTokenAccountsByOwner")?;

    let status = response.status();
    let rpc: TokenAccountsRpcResponse = response.json().await.with_context(|| {
        format!("failed to parse Helius token accounts response (HTTP {status})")
    })?;

    if let Some(error) = rpc.error {
        return Err(anyhow!("Helius RPC error: {}", error.message));
    }

    let accounts = rpc
        .result
        .map(|r| r.value)
        .ok_or_else(|| anyhow!("Helius RPC response missing result"))?;

    let tokens = accounts
        .into_iter()
        .filter_map(|entry| {
            let info = entry.account.data.parsed.info;
            let amount = info.token_amount.ui_amount.unwrap_or(0.0);
            if amount == 0.0 {
                return None;
            }
            Some(RawTokenAccount {
                mint: info.mint,
                amount,
            })
        })
        .collect();

    Ok(tokens)
}

/// Page sizes to try, largest first. A wallet holding many heavy (often spammy)
/// compressed NFTs can blow past Helius's 20MB response cap even at modest
/// page sizes, so on that specific error we retry smaller instead of failing
/// the whole NFT section.
const NFT_ASSET_LIMIT_STEPS: &[u32] = &[100, 40, 15, 5, 1];
const RPC_RESPONSE_TOO_BIG: i64 = -32702;
const FUNGIBLE_INTERFACES: &[&str] = &["FungibleToken", "FungibleAsset"];

/// NFT asset from Helius's DAS `getAssetsByOwner`.
#[derive(Debug, Clone)]
pub struct RawNftAsset {
    pub mint: String,
    pub name: String,
    pub image: Option<String>,
    pub collection: Option<String>,
}

#[derive(Deserialize)]
struct AssetsRpcResponse {
    result: Option<AssetsResult>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct AssetsResult {
    #[serde(default)]
    items: Vec<AssetItem>,
}

#[derive(Deserialize)]
struct AssetItem {
    id: String,
    #[serde(default)]
    interface: String,
    content: Option<AssetContent>,
    #[serde(default)]
    grouping: Vec<AssetGrouping>,
}

#[derive(Deserialize, Default)]
struct AssetContent {
    #[serde(default)]
    metadata: AssetMetadata,
    #[serde(default)]
    links: AssetLinks,
}

#[derive(Deserialize, Default)]
struct AssetMetadata {
    #[serde(default)]
    name: String,
}

#[derive(Deserialize, Default)]
struct AssetLinks {
    #[serde(default)]
    image: Option<String>,
}

#[derive(Deserialize)]
struct AssetGrouping {
    group_key: String,
    group_value: String,
}

/// Fetch a wallet's NFTs (compressed + regular) via Helius DAS `getAssetsByOwner`,
/// excluding fungible tokens which are covered by `get_token_accounts` instead.
pub async fn get_nft_assets(
    client: &Client,
    api_key: &str,
    address: &str,
) -> Result<Vec<RawNftAsset>> {
    let last_step = NFT_ASSET_LIMIT_STEPS.len() - 1;
    for (step, &limit) in NFT_ASSET_LIMIT_STEPS.iter().enumerate() {
        match fetch_assets_page(client, api_key, address, limit).await {
            Ok(items) => return Ok(parse_nft_items(items)),
            Err(err) if is_response_too_big(&err) && step < last_step => continue,
            Err(err) if is_response_too_big(&err) => {
                tracing::warn!(
                    %address,
                    "NFT response still too big at minimum page size; returning empty"
                );
                return Ok(Vec::new());
            }
            Err(err) => return Err(err),
        }
    }
    Ok(Vec::new())
}

fn is_response_too_big(err: &anyhow::Error) -> bool {
    err.downcast_ref::<HeliusRpcError>()
        .is_some_and(|e| e.code == RPC_RESPONSE_TOO_BIG)
}

#[derive(Debug)]
struct HeliusRpcError {
    code: i64,
    message: String,
}

impl std::fmt::Display for HeliusRpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Helius RPC error {}: {}", self.code, self.message)
    }
}

impl std::error::Error for HeliusRpcError {}

async fn fetch_assets_page(
    client: &Client,
    api_key: &str,
    address: &str,
    limit: u32,
) -> Result<Vec<AssetItem>> {
    let url = format!("https://mainnet.helius-rpc.com/?api-key={api_key}");

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAssetsByOwner",
        "params": {
            "ownerAddress": address,
            "page": 1,
            "limit": limit,
            "displayOptions": { "showFungible": false },
        },
    });

    let request = client.post(&url).json(&body);
    let response = crate::http_util::send_with_retry(request, 2)
        .await
        .context("failed to call Helius getAssetsByOwner")?;

    let status = response.status();
    let rpc: AssetsRpcResponse = response.json().await.with_context(|| {
        format!("failed to parse Helius getAssetsByOwner response (HTTP {status})")
    })?;

    if let Some(error) = rpc.error {
        return Err(HeliusRpcError {
            code: error.code,
            message: error.message,
        }
        .into());
    }

    Ok(rpc.result.map(|r| r.items).unwrap_or_default())
}

fn parse_nft_items(items: Vec<AssetItem>) -> Vec<RawNftAsset> {
    items
        .into_iter()
        .filter(|item| !FUNGIBLE_INTERFACES.contains(&item.interface.as_str()))
        .map(|item| {
            let content = item.content.unwrap_or_default();
            let name = if content.metadata.name.trim().is_empty() {
                "Unnamed NFT".to_string()
            } else {
                content.metadata.name
            };
            let collection = item
                .grouping
                .into_iter()
                .find(|g| g.group_key == "collection")
                .map(|g| g.group_value);

            RawNftAsset {
                mint: item.id,
                name,
                image: content.links.image,
                collection,
            }
        })
        .collect()
}

const ENHANCED_TX_LIMIT: u32 = 50;

/// Native or SPL transfer parsed from Helius enhanced transactions.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedTransfer {
    pub from: String,
    pub to: String,
    /// SOL for native transfers; token UI amount otherwise.
    pub amount_ui: f64,
    pub is_native: bool,
}

#[derive(Deserialize)]
struct EnhancedTransaction {
    #[serde(rename = "nativeTransfers", default)]
    native_transfers: Vec<NativeTransfer>,
    #[serde(rename = "tokenTransfers", default)]
    token_transfers: Vec<TokenTransfer>,
}

#[derive(Deserialize)]
struct NativeTransfer {
    #[serde(rename = "fromUserAccount", default)]
    from_user_account: String,
    #[serde(rename = "toUserAccount", default)]
    to_user_account: String,
    /// Lamports.
    amount: u64,
}

#[derive(Deserialize)]
struct TokenTransfer {
    #[serde(rename = "fromUserAccount", default)]
    from_user_account: String,
    #[serde(rename = "toUserAccount", default)]
    to_user_account: String,
    #[serde(rename = "tokenAmount")]
    token_amount: Option<serde_json::Value>,
}

/// Recent native + token transfers for `address` via Helius enhanced transactions.
pub async fn get_recent_transfers(
    client: &Client,
    api_key: &str,
    address: &str,
) -> Result<Vec<ParsedTransfer>> {
    let url = format!(
        "https://api.helius.xyz/v0/addresses/{address}/transactions?api-key={api_key}&limit={ENHANCED_TX_LIMIT}"
    );

    let request = client.get(&url);
    let response = crate::http_util::send_with_retry(request, 2)
        .await
        .context("failed to call Helius enhanced transactions")?;

    let status = response.status();
    if !status.is_success() {
        anyhow::bail!("Helius enhanced transactions returned HTTP {status}");
    }

    let txs: Vec<EnhancedTransaction> = response
        .json()
        .await
        .with_context(|| format!("failed to parse Helius enhanced transactions (HTTP {status})"))?;

    let mut transfers = Vec::new();
    for tx in txs {
        for native in tx.native_transfers {
            if native.from_user_account.is_empty() || native.to_user_account.is_empty() {
                continue;
            }
            transfers.push(ParsedTransfer {
                from: native.from_user_account,
                to: native.to_user_account,
                amount_ui: native.amount as f64 / LAMPORTS_PER_SOL,
                is_native: true,
            });
        }
        for token in tx.token_transfers {
            if token.from_user_account.is_empty() || token.to_user_account.is_empty() {
                continue;
            }
            transfers.push(ParsedTransfer {
                from: token.from_user_account,
                to: token.to_user_account,
                amount_ui: json_amount(token.token_amount.as_ref()),
                is_native: false,
            });
        }
    }
    Ok(transfers)
}

fn json_amount(value: Option<&serde_json::Value>) -> f64 {
    match value {
        Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(serde_json::Value::String(s)) => s.parse().unwrap_or(0.0),
        _ => 0.0,
    }
}
