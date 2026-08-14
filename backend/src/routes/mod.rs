pub mod health;
pub mod wallet;

use axum::Router;
use axum::middleware;
use utoipa::OpenApi;
use utoipa_swagger_ui::{BasicAuth, Config, SwaggerUi};

use crate::AppState;
use crate::auth::require_api_key;
use crate::openapi::ApiDoc;
use crate::rate_limit::wallet_rate_limit;

#[derive(Clone)]
pub struct SwaggerAuth {
    pub username: String,
    pub password: String,
}

pub fn create_router(state: AppState, swagger_auth: SwaggerAuth) -> Router {
    let swagger = SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", ApiDoc::openapi())
        .config(Config::default().basic_auth(BasicAuth {
            username: swagger_auth.username,
            password: swagger_auth.password,
        }));

    let wallet = wallet::routes()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            wallet_rate_limit,
        ))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_api_key,
        ));

    Router::new()
        .merge(health::routes())
        .merge(wallet)
        .merge(swagger)
        .with_state(state)
}
