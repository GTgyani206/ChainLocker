use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub service: &'static str,
    pub status: &'static str,
    pub version: &'static str,
    pub timestamp: DateTime<Utc>,
    pub ipfs: ServiceHealth,
    pub solana: ServiceHealth,
    pub storage: StorageHealth,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceHealth {
    pub reachable: bool,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageHealth {
    pub ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResponse {
    pub document_id: String,
    pub original_filename: String,
    pub sha256_hex: String,
    pub ipfs_cid: String,
    pub pda: String,
    pub size_bytes: u64,
    pub stored_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueRequest {
    pub sha256_hex: String,
    pub ipfs_cid: String,
    pub issued_at_unix: Option<i64>,
    pub dry_run: Option<bool>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueResponse {
    pub sha256_hex: String,
    pub ipfs_cid: String,
    pub pda: String,
    pub issued_at_unix: i64,
    pub signature: Option<String>,
    pub explorer_url: Option<String>,
    pub mode: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRequest {
    pub sha256_hex: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResponse {
    pub sha256_hex: String,
    pub exists: bool,
    pub pda: String,
    pub issuer: Option<String>,
    pub on_chain_cid: Option<String>,
    pub issued_at_unix: Option<i64>,
    pub is_revoked: Option<bool>,
    pub transaction_signature: Option<String>,
    pub explorer_url: Option<String>,
    pub local_record: Option<PublicRecordSummary>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemConfigResponse {
    pub bind_address: String,
    pub max_upload_bytes: usize,
    pub ipfs_api_url: String,
    pub ipfs_pin: bool,
    pub solana_rpc_url: String,
    pub solana_program_id: String,
    pub solana_cluster: String,
    pub has_issuer_keypair: bool,
    pub admin_auth_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredDocumentRecord {
    pub document_id: String,
    pub original_filename: String,
    pub sha256_hex: String,
    pub ipfs_cid: String,
    pub pda: String,
    pub size_bytes: u64,
    pub stored_at: DateTime<Utc>,
    pub local_path: String,
    pub last_signature: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicRecordSummary {
    pub ipfs_cid: String,
    pub stored_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub at: DateTime<Utc>,
    pub action: String,
    pub status: String,
    pub sha256_hex: Option<String>,
    pub detail: String,
}
