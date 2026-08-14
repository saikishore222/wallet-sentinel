use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct WalletSummary {
    pub address: String,
    pub sol_balance: f64,
}

#[derive(Clone, Serialize, ToSchema)]
pub struct TokenHolding {
    pub mint: String,
    pub amount: f64,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct TokensResponse {
    pub address: String,
    pub tokens: Vec<TokenHolding>,
}
