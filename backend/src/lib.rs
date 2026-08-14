pub mod auth;
pub mod error;
pub mod http_util;
pub mod models;
pub mod openapi;
pub mod rate_limit;
pub mod routes;
pub mod services;
pub mod state;
pub mod validation;

pub use routes::SwaggerAuth;
pub use state::AppState;

use std::env;

use axum::Router;
use axum::http::{HeaderName, HeaderValue, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};

pub fn app(state: AppState, swagger_auth: SwaggerAuth) -> Router {
    let router = routes::create_router(state, swagger_auth);
    match cors_layer() {
        Some(layer) => router.layer(layer),
        None => router,
    }
}

fn cors_layer() -> Option<CorsLayer> {
    let raw = env::var("CORS_ORIGIN").unwrap_or_default();
    let origins: Vec<HeaderValue> = raw
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|origin| origin.parse().ok())
        .collect();

    if origins.is_empty() {
        return None;
    }

    Some(
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods([Method::GET, Method::OPTIONS])
            .allow_headers([HeaderName::from_static("x-api-key")]),
    )
}

#[cfg(test)]
mod api_key_tests {
    use axum::body::{Body, to_bytes};
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    use super::*;

    fn test_app() -> Router {
        let client = reqwest::Client::new();
        let state = AppState::new(
            "test-secret".to_string(),
            "helius".to_string(),
            None,
            client,
        );
        let swagger = SwaggerAuth {
            username: "admin".to_string(),
            password: "pass".to_string(),
        };
        app(state, swagger)
    }

    #[tokio::test]
    async fn health_is_open_without_api_key() {
        let response = test_app()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn wallet_without_api_key_is_unauthorized() {
        let response = test_app()
            .oneshot(
                Request::builder()
                    .uri("/wallet/11111111111111111111111111111111/summary")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["error"], "unauthorized");
    }

    #[tokio::test]
    async fn wallet_wrong_api_key_is_unauthorized() {
        let response = test_app()
            .oneshot(
                Request::builder()
                    .uri("/wallet/not-a-wallet/summary")
                    .header("x-api-key", "wrong")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn wallet_with_api_key_rejects_invalid_address() {
        let response = test_app()
            .oneshot(
                Request::builder()
                    .uri("/wallet/not-a-wallet/summary")
                    .header("x-api-key", "test-secret")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
