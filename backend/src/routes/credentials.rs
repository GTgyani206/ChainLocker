use axum::{extract::State, http::HeaderMap, Json};
use chrono::Utc;

use crate::{
    error::AppError,
    models::{
        AuditEvent, IssueRequest, IssueResponse, PublicRecordSummary, VerifyRequest, VerifyResponse,
    },
    state::AppState,
};

const MAX_NOTE_CHARS: usize = 512;

pub async fn issue_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<IssueRequest>,
) -> Result<Json<IssueResponse>, AppError> {
    super::documents::require_admin(&state, &headers)?;

    let hash_bytes = decode_hash(&payload.sha256_hex)?;
    validate_ipfs_cid(&payload.ipfs_cid)?;
    validate_note(payload.note.as_deref())?;
    let issued_at_unix = payload
        .issued_at_unix
        .unwrap_or_else(|| Utc::now().timestamp());
    if issued_at_unix <= 0 {
        return Err(AppError::bad_request(
            "issuedAtUnix must be a positive unix timestamp",
        ));
    }

    if let Some(record) = state.storage.load_record(&payload.sha256_hex).await? {
        if record.ipfs_cid != payload.ipfs_cid {
            return Err(AppError::bad_request(
                "ipfsCid does not match the locally stored record for this hash",
            ));
        }
    }

    let result = state
        .solana
        .issue_credential(
            hash_bytes,
            payload.ipfs_cid.clone(),
            issued_at_unix,
            payload.dry_run.unwrap_or(false),
        )
        .await?;

    state
        .storage
        .update_record_signature(
            &payload.sha256_hex,
            result.signature.clone(),
            payload.note.clone(),
        )
        .await?;

    state
        .audit
        .append(AuditEvent {
            at: Utc::now(),
            action: "credential.issued".into(),
            status: if result.signature.is_some() {
                "submitted"
            } else {
                "preview"
            }
            .into(),
            sha256_hex: Some(payload.sha256_hex.clone()),
            detail: format!("Credential prepared for PDA {}", result.pda),
        })
        .await?;

    Ok(Json(IssueResponse {
        sha256_hex: payload.sha256_hex,
        ipfs_cid: payload.ipfs_cid,
        pda: result.pda,
        issued_at_unix,
        signature: result.signature.clone(),
        explorer_url: result
            .signature
            .as_deref()
            .map(|sig| state.solana.explorer_tx_url(sig)),
        mode: result.mode,
        note: payload.note,
    }))
}

pub async fn verify_credential(
    State(state): State<AppState>,
    Json(payload): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, AppError> {
    let hash_bytes = decode_hash(&payload.sha256_hex)?;
    let chain = state.solana.verify_credential(hash_bytes).await?;
    let stored_record = state.storage.load_record(&payload.sha256_hex).await?;
    let is_valid = chain.exists && chain.is_revoked != Some(true);
    let transaction_signature = stored_record
        .as_ref()
        .and_then(|record| record.last_signature.clone());
    let explorer_url = transaction_signature
        .as_deref()
        .map(|signature| state.solana.explorer_tx_url(signature));
    let local_record = stored_record.map(|record| PublicRecordSummary {
            ipfs_cid: record.ipfs_cid,
            stored_at: record.stored_at,
        });

    state
        .audit
        .append(AuditEvent {
            at: Utc::now(),
            action: "credential.verified".into(),
            status: if !chain.exists {
                "missing"
            } else if chain.is_revoked == Some(true) {
                "revoked"
            } else {
                "found"
            }
            .into(),
            sha256_hex: Some(payload.sha256_hex.clone()),
            detail: format!("Verification checked against PDA {}", chain.pda),
        })
        .await?;

    Ok(Json(VerifyResponse {
        sha256_hex: payload.sha256_hex,
        exists: is_valid,
        pda: chain.pda,
        issuer: chain.issuer,
        on_chain_cid: chain.cid,
        issued_at_unix: chain.issued_at_unix,
        is_revoked: chain.is_revoked,
        transaction_signature,
        explorer_url,
        local_record,
    }))
}

fn decode_hash(hex_hash: &str) -> Result<[u8; 32], AppError> {
    let bytes = hex::decode(hex_hash)
        .map_err(|_| AppError::bad_request("sha256Hex must be valid hexadecimal"))?;
    if bytes.len() != 32 {
        return Err(AppError::bad_request(
            "sha256Hex must decode to exactly 32 bytes",
        ));
    }

    let mut hash = [0_u8; 32];
    hash.copy_from_slice(&bytes);
    Ok(hash)
}

fn validate_ipfs_cid(ipfs_cid: &str) -> Result<(), AppError> {
    let cid = ipfs_cid.trim();
    if cid.len() < 32 || cid.len() > 128 {
        return Err(AppError::bad_request(
            "ipfsCid must be between 32 and 128 characters",
        ));
    }
    if !cid.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err(AppError::bad_request("ipfsCid must be ASCII alphanumeric"));
    }
    Ok(())
}

fn validate_note(note: Option<&str>) -> Result<(), AppError> {
    if let Some(note) = note {
        if note.chars().count() > MAX_NOTE_CHARS {
            return Err(AppError::bad_request("note is too long"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decode_hash, validate_ipfs_cid, validate_note};

    #[test]
    fn decode_hash_accepts_valid_sha256_hex() {
        let hash = "ab".repeat(32);
        assert!(decode_hash(&hash).is_ok());
    }

    #[test]
    fn decode_hash_rejects_invalid_length() {
        assert!(decode_hash("abcd").is_err());
    }

    #[test]
    fn cid_validation_rejects_symbols() {
        assert!(validate_ipfs_cid("bafy!invalid").is_err());
    }

    #[test]
    fn note_validation_rejects_large_values() {
        let large = "a".repeat(513);
        assert!(validate_note(Some(&large)).is_err());
    }
}
