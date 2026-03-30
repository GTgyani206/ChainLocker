mod config;
mod error;
mod models;
mod routes;
mod services;
mod state;

use std::path::PathBuf;

use axum::{
    extract::{DefaultBodyLimit, Request},
    http::{header, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use config::AppConfig;
use services::{
    audit::AuditService, ipfs::IpfsService, solana::SolanaService, storage::StorageService,
};
use state::AppState;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing::{info, Level};
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = AppConfig::from_env()?;
    let storage = StorageService::new(&config.storage).await?;
    let audit = AuditService::new(storage.audit_log_path().to_path_buf());
    let http = reqwest::Client::builder()
        .timeout(config.http_timeout())
        .build()?;

    let state = AppState::new(
        config.clone(),
        storage,
        audit,
        IpfsService::new(config.ipfs.clone(), http.clone()),
        SolanaService::new(config.solana.clone(), http.clone()),
    );

    let app = build_router(state.clone(), static_root())
        .layer(DefaultBodyLimit::max(config.server.max_upload_bytes))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(middleware::from_fn(set_security_headers))
        .layer(cors_layer(&config));

    let listener = tokio::net::TcpListener::bind(config.server.bind_addr).await?;
    info!(
        "chainlocker backend listening on {}",
        config.server.bind_addr
    );
    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState, static_dir: PathBuf) -> Router {
    let static_service =
        ServeDir::new(&static_dir).not_found_service(ServeFile::new(static_dir.join("index.html")));

    let api = Router::new()
        .route("/health", get(routes::health::health))
        .route("/system/config", get(routes::system::config))
        .route("/system/activity", get(routes::system::activity))
        .route("/documents", get(routes::documents::list_documents))
        .route("/documents/upload", post(routes::documents::upload_document))
        .route(
            "/documents/:sha256Hex/download",
            get(routes::documents::download_document),
        )
        .route(
            "/credentials/issue",
            post(routes::credentials::issue_credential),
        )
        .route(
            "/credentials/verify",
            post(routes::credentials::verify_credential),
        )
        .fallback(|| async { StatusCode::NOT_FOUND })
        .with_state(state);

    Router::new()
        .nest("/api/v1", api)
        .fallback_service(static_service)
}

fn cors_layer(config: &AppConfig) -> CorsLayer {
    let mut layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::HeaderName::from_static("x-chainlocker-admin-token"),
        ]);

    if config.server.cors_allow_origin == "*" {
        layer = layer.allow_origin(tower_http::cors::Any);
    } else if let Ok(value) = HeaderValue::from_str(&config.server.cors_allow_origin) {
        layer = layer.allow_origin(value);
    }

    layer
}

fn static_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("static")
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::from("chainlocker_backend=debug,tower_http=info,axum=info"));

    fmt()
        .with_env_filter(filter)
        .with_max_level(Level::INFO)
        .with_target(false)
        .compact()
        .init();
}

async fn set_security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        header::HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        header::HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        header::HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    headers.insert(
        header::HeaderName::from_static("content-security-policy"),
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        ),
    );
    response
}
