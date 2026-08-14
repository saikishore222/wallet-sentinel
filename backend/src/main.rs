use std::env;
use std::net::SocketAddr;
use std::time::Duration;

use backend::{AppState, SwaggerAuth, app};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let api_key = env::var("API_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .expect("API_KEY must be set");
    let helius_api_key = env::var("HELIUS_API_KEY").expect("HELIUS_API_KEY must be set");
    let jupiter_api_key = env::var("JUPITER_API_KEY").ok().filter(|s| !s.is_empty());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());

    let swagger_auth = SwaggerAuth {
        username: env::var("SWAGGER_USERNAME").unwrap_or_else(|_| "admin".to_string()),
        password: env::var("SWAGGER_PASSWORD").expect("SWAGGER_PASSWORD must be set"),
    };

    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .expect("failed to build HTTP client");

    let state = AppState::new(api_key, helius_api_key, jupiter_api_key, http_client);
    let app = app(state, swagger_auth);

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|err| panic!("failed to bind to {addr}: {err}"));

    tracing::info!("listening on http://{addr}");
    tracing::info!("swagger ui on http://{addr}/swagger-ui/ (basic auth required)");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("server error");
}
