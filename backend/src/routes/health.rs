use axum::{Json, Router, routing::get};

use crate::AppState;
use crate::models::HealthResponse;

pub fn routes() -> Router<AppState> {
    Router::new().route("/health", get(health))
}

#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthResponse)
    )
)]
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}
