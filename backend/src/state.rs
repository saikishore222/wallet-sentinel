use std::ops::Deref;
use std::sync::Arc;
use std::time::Duration;

use moka::future::Cache;
use reqwest::Client;

use crate::models::TokenHolding;
use crate::rate_limit::RateLimiter;
use crate::services::token_list::VerifiedTokenIndex;

const TOKEN_ACCOUNTS_TTL: Duration = Duration::from_secs(60);
const VERIFIED_MINTS_TTL: Duration = Duration::from_secs(5 * 60);

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

pub struct AppStateInner {
    pub api_key: String,
    pub helius_api_key: String,
    pub jupiter_api_key: Option<String>,
    pub http_client: Client,
    pub token_accounts_cache: Cache<String, Vec<TokenHolding>>,
    pub verified_tokens_cache: Cache<String, VerifiedTokenIndex>,
    pub rate_limiter: RateLimiter,
}

impl AppState {
    pub fn new(
        api_key: String,
        helius_api_key: String,
        jupiter_api_key: Option<String>,
        http_client: Client,
    ) -> Self {
        let token_accounts_cache = Cache::builder().time_to_live(TOKEN_ACCOUNTS_TTL).build();

        let verified_tokens_cache = Cache::builder().time_to_live(VERIFIED_MINTS_TTL).build();

        Self {
            inner: Arc::new(AppStateInner {
                api_key,
                helius_api_key,
                jupiter_api_key,
                http_client,
                token_accounts_cache,
                verified_tokens_cache,
                rate_limiter: RateLimiter::new(),
            }),
        }
    }
}

impl Deref for AppState {
    type Target = AppStateInner;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}
