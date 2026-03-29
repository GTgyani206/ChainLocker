use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;

use crate::{
    error::AppError,
    models::{AuditEvent, SystemConfigResponse},
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityQuery {
    pub limit: Option<usize>,
}

pub async fn config(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SystemConfigResponse>, AppError> {
    super::documents::require_admin(&state, &headers)?;
    Ok(Json(SystemConfigResponse {
        bind_address: state.config.server.bind_addr.to_string(),
        max_upload_bytes: state.config.server.max_upload_bytes,
        ipfs_api_url: state.config.ipfs.api_url.clone(),
        ipfs_pin: state.config.ipfs.pin,
        solana_rpc_url: state.config.solana.rpc_url.clone(),
        solana_program_id: state.config.solana.program_id.clone(),
        solana_cluster: state.config.solana.cluster.clone(),
        has_issuer_keypair: state.config.solana.issuer_keypair.is_some(),
        admin_auth_enabled: state.config.security.admin_token.is_some(),
    }))
}

pub async fn activity(
    State(state): State<AppState>,
    Query(query): Query<ActivityQuery>,
    headers: HeaderMap,
) -> Result<Json<Vec<AuditEvent>>, AppError> {
    super::documents::require_admin(&state, &headers)?;
    Ok(Json(
        state
            .audit
            .recent(query.limit.unwrap_or(25).min(100))
            .await?,
    ))
}
