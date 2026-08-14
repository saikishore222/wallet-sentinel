use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, State};
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;

use crate::AppState;
use crate::error::AppError;

const MAX_REQUESTS: usize = 60;
const WINDOW: Duration = Duration::from_secs(60);

pub struct RateLimiter {
    inner: Mutex<HashMap<String, Vec<Instant>>>,
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn allow(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut map = self.inner.lock().expect("rate limiter mutex poisoned");
        let stamps = map.entry(key.to_string()).or_default();
        stamps.retain(|t| now.duration_since(*t) < WINDOW);
        if stamps.len() >= MAX_REQUESTS {
            return false;
        }
        stamps.push(now);
        true
    }
}

pub async fn wallet_rate_limit(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AppError> {
    let forwarded = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned);

    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip().to_string());

    let key = forwarded.or(peer).unwrap_or_else(|| "unknown".to_string());

    if !state.rate_limiter.allow(&key) {
        return Err(AppError::TooManyRequests(
            "rate limit exceeded; try again shortly".to_string(),
        ));
    }
    Ok(next.run(request).await)
}
