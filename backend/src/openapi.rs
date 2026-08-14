use utoipa::OpenApi;

use crate::models::{
    ErrorBody, HealthResponse, RiskFlag, RiskSeverity, RisksResponse, TokenHolding, TokensResponse,
    WalletSummary,
};
use crate::routes;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Wallet Sentinel API",
        description = "Solana wallet balance, token holdings, and risk analysis",
        version = "0.1.0"
    ),
    paths(
        routes::health::health,
        routes::wallet::wallet_summary,
        routes::wallet::wallet_tokens,
        routes::wallet::wallet_risks,
    ),
    components(schemas(
        HealthResponse,
        WalletSummary,
        TokenHolding,
        TokensResponse,
        RiskSeverity,
        RiskFlag,
        RisksResponse,
        ErrorBody,
    )),
    tags(
        (name = "health", description = "Service health"),
        (name = "wallet", description = "Wallet summary, tokens, and risks"),
    )
)]
pub struct ApiDoc;
