use axum::{
    Json, Router,
    extract::{Path, State},
    routing::get,
};

use crate::AppState;
use crate::error::AppError;
use crate::models::{
    ErrorBody, NftHolding, NftsResponse, RisksResponse, TokenHolding, TokensResponse,
    WalletSummary,
};
use crate::services::token_list::VerifiedTokenIndex;
use crate::services::{analyzer, helius, token_list};
use crate::validation::is_valid_solana_address;

const VERIFIED_TOKENS_CACHE_KEY: &str = "jupiter_strict";

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/wallet/{address}/summary", get(wallet_summary))
        .route("/wallet/{address}/tokens", get(wallet_tokens))
        .route("/wallet/{address}/nfts", get(wallet_nfts))
        .route("/wallet/{address}/risks", get(wallet_risks))
}

fn require_address(address: &str) -> Result<(), AppError> {
    if is_valid_solana_address(address) {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "invalid Solana wallet address".to_string(),
        ))
    }
}

#[utoipa::path(
    get,
    path = "/wallet/{address}/summary",
    tag = "wallet",
    params(
        ("address" = String, Path, description = "Solana wallet address")
    ),
    responses(
        (status = 200, description = "SOL balance summary", body = WalletSummary),
        (status = 400, description = "Invalid address", body = ErrorBody),
        (status = 401, description = "Missing or invalid API key", body = ErrorBody),
        (status = 429, description = "Rate limited", body = ErrorBody),
        (status = 502, description = "Upstream unavailable", body = ErrorBody)
    )
)]
pub async fn wallet_summary(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<WalletSummary>, AppError> {
    require_address(&address)?;
    let sol_balance =
        helius::get_sol_balance(&state.http_client, &state.helius_api_key, &address).await?;

    Ok(Json(WalletSummary {
        address,
        sol_balance,
    }))
}

#[utoipa::path(
    get,
    path = "/wallet/{address}/tokens",
    tag = "wallet",
    params(
        ("address" = String, Path, description = "Solana wallet address")
    ),
    responses(
        (status = 200, description = "SPL token holdings with verification flags", body = TokensResponse),
        (status = 400, description = "Invalid address", body = ErrorBody),
        (status = 401, description = "Missing or invalid API key", body = ErrorBody),
        (status = 429, description = "Rate limited", body = ErrorBody),
        (status = 502, description = "Upstream unavailable", body = ErrorBody)
    )
)]
pub async fn wallet_tokens(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<TokensResponse>, AppError> {
    require_address(&address)?;
    let tokens = fetch_token_holdings(&state, &address).await?;
    Ok(Json(TokensResponse { address, tokens }))
}

#[utoipa::path(
    get,
    path = "/wallet/{address}/nfts",
    tag = "wallet",
    params(
        ("address" = String, Path, description = "Solana wallet address")
    ),
    responses(
        (status = 200, description = "NFT holdings", body = NftsResponse),
        (status = 400, description = "Invalid address", body = ErrorBody),
        (status = 401, description = "Missing or invalid API key", body = ErrorBody),
        (status = 429, description = "Rate limited", body = ErrorBody),
        (status = 502, description = "Upstream unavailable", body = ErrorBody)
    )
)]
pub async fn wallet_nfts(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<NftsResponse>, AppError> {
    require_address(&address)?;
    let nfts = fetch_nft_holdings(&state, &address).await?;
    Ok(Json(NftsResponse { address, nfts }))
}

#[utoipa::path(
    get,
    path = "/wallet/{address}/risks",
    tag = "wallet",
    params(
        ("address" = String, Path, description = "Solana wallet address")
    ),
    responses(
        (status = 200, description = "Risk flags for the wallet", body = RisksResponse),
        (status = 400, description = "Invalid address", body = ErrorBody),
        (status = 401, description = "Missing or invalid API key", body = ErrorBody),
        (status = 429, description = "Rate limited", body = ErrorBody),
        (status = 502, description = "Upstream unavailable", body = ErrorBody)
    )
)]
pub async fn wallet_risks(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<RisksResponse>, AppError> {
    require_address(&address)?;
    let (tokens, transfers) = tokio::join!(
        fetch_token_holdings(&state, &address),
        helius::get_recent_transfers(&state.http_client, &state.helius_api_key, &address),
    );
    let tokens = tokens?;
    let (mut flags, _) = analyzer::analyze(&tokens);
    match transfers {
        Ok(transfers) => {
            flags.extend(analyzer::address_poisoning_flags(&address, &transfers));
        }
        Err(err) => {
            tracing::warn!(error = %err, "skipping address poisoning check");
        }
    }
    let risk_score = analyzer::risk_score(&flags);

    Ok(Json(RisksResponse {
        address,
        risk_score,
        flags,
    }))
}

async fn fetch_token_holdings(
    state: &AppState,
    address: &str,
) -> Result<Vec<TokenHolding>, AppError> {
    if let Some(tokens) = state.token_accounts_cache.get(address).await {
        tracing::info!(%address, "token holdings cache hit");
        return Ok(tokens);
    }

    tracing::info!(%address, "token holdings cache miss");

    let (token_accounts, verified) = tokio::join!(
        helius::get_token_accounts(&state.http_client, &state.helius_api_key, address),
        get_verified_tokens_cached(state),
    );

    let token_accounts = token_accounts?;
    let verified = verified?;

    let tokens: Vec<TokenHolding> = token_accounts
        .into_iter()
        .map(|account| TokenHolding {
            verified: verified.mints.contains(&account.mint),
            symbol: verified.symbols.get(&account.mint).cloned(),
            mint: account.mint,
            amount: account.amount,
        })
        .collect();

    state
        .token_accounts_cache
        .insert(address.to_string(), tokens.clone())
        .await;

    Ok(tokens)
}

async fn fetch_nft_holdings(state: &AppState, address: &str) -> Result<Vec<NftHolding>, AppError> {
    if let Some(nfts) = state.nft_holdings_cache.get(address).await {
        tracing::info!(%address, "nft holdings cache hit");
        return Ok(nfts);
    }

    tracing::info!(%address, "nft holdings cache miss");

    let raw = helius::get_nft_assets(&state.http_client, &state.helius_api_key, address).await?;

    let nfts: Vec<NftHolding> = raw
        .into_iter()
        .map(|asset| NftHolding {
            mint: asset.mint,
            name: asset.name,
            image: asset.image,
            collection: asset.collection,
            verified: asset.verified,
        })
        .collect();

    state
        .nft_holdings_cache
        .insert(address.to_string(), nfts.clone())
        .await;

    Ok(nfts)
}

async fn get_verified_tokens_cached(state: &AppState) -> Result<VerifiedTokenIndex, AppError> {
    if let Some(index) = state
        .verified_tokens_cache
        .get(VERIFIED_TOKENS_CACHE_KEY)
        .await
    {
        tracing::info!("verified mints cache hit");
        return Ok(index);
    }

    tracing::info!("verified mints cache miss");

    let index =
        token_list::get_verified_tokens(&state.http_client, state.jupiter_api_key.as_deref())
            .await?;
    state
        .verified_tokens_cache
        .insert(VERIFIED_TOKENS_CACHE_KEY.to_string(), index.clone())
        .await;

    Ok(index)
}
