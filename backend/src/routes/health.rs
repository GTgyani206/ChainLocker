use axum::{extract::State, Json};
use chrono::Utc;

use crate::{
    error::AppError,
    models::{HealthResponse, ServiceHealth, StorageHealth},
    state::AppState,
};

pub async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>, AppError> {
    let (ipfs, solana) = tokio::join!(state.ipfs.health(), state.solana.health());

    let ipfs = ipfs.unwrap_or_else(|error| ServiceHealth {
        reachable: false,
        detail: error,
    });
    let solana = solana.unwrap_or_else(|error| ServiceHealth {
        reachable: false,
        detail: error,
    });

    Ok(Json(HealthResponse {
        service: "chainlocker-backend",
        status: if ipfs.reachable && solana.reachable {
            "ok"
        } else {
            "degraded"
        },
        version: env!("CARGO_PKG_VERSION"),
        timestamp: Utc::now(),
        ipfs,
        solana,
        storage: StorageHealth { ready: true },
    }))
}
