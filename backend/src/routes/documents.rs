use std::path::PathBuf;

use axum::{
    extract::{multipart::Field, Multipart, Path as AxumPath, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::{fs, fs::File, io::AsyncWriteExt};
use uuid::Uuid;

use crate::{
    error::AppError,
    models::{AuditEvent, HolderDocumentSummary, StoredDocumentRecord, UploadResponse},
    state::AppState,
};

const HASH_CHUNK_BYTES: usize = 4096;
const MAX_FILENAME_CHARS: usize = 180;
const FILE_FIELD_NAME: &str = "file";
const SHA256_HEX_FIELD_NAME: &str = "sha256Hex";
const ORIGINAL_FILENAME_FIELD_NAME: &str = "originalFilename";
const ENCRYPTION_KEY_ID_FIELD_NAME: &str = "encryptionKeyId";
const STUDENT_NAME_FIELD_NAME: &str = "studentName";

#[derive(Default)]
struct UploadMetadata {
    sha256_hex: Option<String>,
    original_filename: Option<String>,
    encryption_key_id: Option<String>,
    student_name: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentListQuery {
    pub student_name: Option<String>,
    pub limit: Option<usize>,
}

struct SavedUpload {
    document_id: String,
    uploaded_filename: String,
    uploaded_file_sha256_hex: String,
    local_path: PathBuf,
    size_bytes: u64,
}

pub async fn upload_document(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    require_admin(&state, &headers)?;

    let mut metadata = UploadMetadata::default();
    let mut uploaded = None;

    while let Some(field) = multipart.next_field().await? {
        match field.name() {
            Some(FILE_FIELD_NAME) => {
                if uploaded.is_some() {
                    return Err(AppError::bad_request(
                        "only one file may be uploaded per request",
                    ));
                }
                uploaded = Some(save_upload_field(&state, field).await?);
            }
            Some(SHA256_HEX_FIELD_NAME) => {
                metadata.sha256_hex = Some(read_text_field(SHA256_HEX_FIELD_NAME, field).await?);
            }
            Some(ORIGINAL_FILENAME_FIELD_NAME) => {
                metadata.original_filename =
                    Some(read_text_field(ORIGINAL_FILENAME_FIELD_NAME, field).await?);
            }
            Some(ENCRYPTION_KEY_ID_FIELD_NAME) => {
                metadata.encryption_key_id =
                    Some(read_text_field(ENCRYPTION_KEY_ID_FIELD_NAME, field).await?);
            }
            Some(STUDENT_NAME_FIELD_NAME) => {
                metadata.student_name = Some(read_text_field(STUDENT_NAME_FIELD_NAME, field).await?);
            }
            _ => {}
        }
    }

    let uploaded = uploaded
        .ok_or_else(|| AppError::bad_request("multipart field `file` is required"))?;
    let cleanup_path = uploaded.local_path.clone();
    let response = finalize_upload(&state, uploaded, metadata).await;

    if response.is_err() {
        let _ = fs::remove_file(&cleanup_path).await;
    }

    response.map(Json)
}

pub async fn list_documents(
    State(state): State<AppState>,
    Query(query): Query<DocumentListQuery>,
) -> Result<Json<Vec<HolderDocumentSummary>>, AppError> {
    let student_name_filter = normalized_optional_text(query.student_name.as_deref());
    let limit = query.limit.unwrap_or(25).clamp(1, 100);

    let records = state.storage.list_records().await?;
    let summaries = records
        .into_iter()
        .filter_map(|record| {
            let student_name = document_student_name(&record);
            if !student_name_matches(student_name_filter.as_deref(), student_name.as_deref()) {
                return None;
            }

            let explorer_url = record
                .last_signature
                .as_deref()
                .map(|signature| state.solana.explorer_tx_url(signature));

            Some(HolderDocumentSummary {
                document_id: record.document_id,
                student_name,
                original_filename: record.original_filename,
                sha256_hex: record.sha256_hex,
                ipfs_cid: record.ipfs_cid,
                pda: record.pda,
                stored_at: record.stored_at,
                encryption_key_id: record.encryption_key_id,
                transaction_signature: record.last_signature,
                explorer_url,
            })
        })
        .take(limit)
        .collect();

    Ok(Json(summaries))
}

pub async fn download_document(
    State(state): State<AppState>,
    AxumPath(sha256_hex): AxumPath<String>,
) -> Result<impl IntoResponse, AppError> {
    let record = state
        .storage
        .load_record(&sha256_hex)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "not_found", "document not found"))?;

    let encrypted_payload = match fs::read(&record.local_path).await {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            state.ipfs.cat_cid(&record.ipfs_cid).await?
        }
        Err(error) => return Err(error.into()),
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/vnd.chainlocker.encrypted+json"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!(
            "attachment; filename=\"{}\"",
            encrypted_download_filename(&record.original_filename)
        ))
        .map_err(|error| AppError::internal_logged("internal server error", error))?,
    );

    Ok((headers, encrypted_payload))
}

pub fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let Some(expected) = state.config.security.admin_token.as_ref() else {
        return Ok(());
    };

    let provided = headers
        .get("x-chainlocker-admin-token")
        .or_else(|| headers.get(axum::http::header::AUTHORIZATION))
        .and_then(|value| value.to_str().ok())
        .map(|value| value.strip_prefix("Bearer ").unwrap_or(value));

    match provided {
        Some(token) if token_matches(token, expected) => Ok(()),
        _ => Err(AppError::unauthorized("missing or invalid admin token")),
    }
}

fn sanitize_filename(input: &str) -> String {
    input
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' => ch,
            _ => '_',
        })
        .collect()
}

fn token_matches(provided: &str, expected: &str) -> bool {
    if provided.len() != expected.len() {
        return false;
    }
    provided.as_bytes().ct_eq(expected.as_bytes()).into()
}

fn validated_filename(input: Option<&str>) -> Result<String, AppError> {
    let raw = input.unwrap_or("document.bin").trim();
    if raw.is_empty() {
        return Err(AppError::bad_request("file name must not be empty"));
    }
    if raw.chars().count() > MAX_FILENAME_CHARS {
        return Err(AppError::bad_request("file name is too long"));
    }

    let sanitized = sanitize_filename(raw);
    if sanitized.chars().all(|ch| ch == '_' || ch == '.') {
        return Err(AppError::bad_request(
            "file name must contain visible characters",
        ));
    }
    Ok(sanitized)
}

async fn save_upload_field(state: &AppState, field: Field<'_>) -> Result<SavedUpload, AppError> {
    let uploaded_filename = validated_filename(field.file_name())?;
    let document_id = Uuid::new_v4().to_string();
    let upload_name = format!("{}-{}", document_id, uploaded_filename);
    let local_path = state.storage.uploads_dir().join(upload_name);
    let saved_local_path = local_path.clone();

    let result = async {
        let mut file = File::create(&local_path).await?;
        let mut hasher = Sha256::new();
        let mut size_bytes = 0_u64;
        let mut field = field;

        while let Some(chunk) = field.chunk().await? {
            for slice in chunk.chunks(HASH_CHUNK_BYTES) {
                size_bytes += slice.len() as u64;
                if size_bytes > state.config.server.max_upload_bytes as u64 {
                    return Err(AppError::payload_too_large(
                        "upload exceeds the configured size limit",
                    ));
                }
                hasher.update(slice);
                file.write_all(slice).await?;
            }
        }

        if size_bytes == 0 {
            return Err(AppError::bad_request("empty files are not allowed"));
        }

        file.flush().await?;

        let uploaded_file_sha256_hex = hex::encode(<[u8; 32]>::from(hasher.finalize()));
        Ok(SavedUpload {
            document_id,
            uploaded_filename,
            uploaded_file_sha256_hex,
            local_path: saved_local_path,
            size_bytes,
        })
    }
    .await;

    if result.is_err() {
        let _ = fs::remove_file(&local_path).await;
    }

    result
}

async fn finalize_upload(
    state: &AppState,
    uploaded: SavedUpload,
    metadata: UploadMetadata,
) -> Result<UploadResponse, AppError> {
    let sha256_hex_was_supplied = metadata.sha256_hex.is_some();
    let original_filename = validated_filename(
        metadata
            .original_filename
            .as_deref()
            .or(Some(uploaded.uploaded_filename.as_str())),
    )?;
    let sha256_hex = match metadata.sha256_hex {
        Some(sha256_hex) => validate_sha256_hex(&sha256_hex)?,
        None => uploaded.uploaded_file_sha256_hex.clone(),
    };

    // When the browser sends `sha256Hex`, it hashed the original PDF before encrypting it.
    // The file saved locally and pinned to IPFS/Pinata is the encrypted blob, not the raw PDF.
    let hash_bytes = decode_sha256_hex(&sha256_hex)?;
    let ipfs_result = state
        .ipfs
        .add_file(&uploaded.local_path, &uploaded.uploaded_filename)
        .await?;
    let pda = state.solana.derive_pda(&hash_bytes)?.to_string();

    let record = StoredDocumentRecord {
        document_id: uploaded.document_id.clone(),
        student_name: normalized_optional_text(metadata.student_name.as_deref()),
        original_filename: original_filename.clone(),
        sha256_hex: sha256_hex.clone(),
        ipfs_cid: ipfs_result.cid.clone(),
        pda: pda.clone(),
        size_bytes: uploaded.size_bytes,
        stored_at: Utc::now(),
        local_path: uploaded.local_path.display().to_string(),
        encryption_key_id: metadata.encryption_key_id.clone(),
        last_signature: None,
        note: None,
    };

    state.storage.save_record(&record).await?;
    state
        .audit
        .append(AuditEvent {
            at: Utc::now(),
            action: "document.uploaded".into(),
            status: "success".into(),
            sha256_hex: Some(sha256_hex.clone()),
            detail: upload_audit_detail(
                &original_filename,
                &ipfs_result.cid,
                metadata.encryption_key_id.as_deref(),
                sha256_hex_was_supplied,
            ),
        })
        .await?;

    Ok(UploadResponse {
        document_id: uploaded.document_id,
        original_filename,
        sha256_hex,
        ipfs_cid: ipfs_result.cid,
        pda,
        size_bytes: record.size_bytes,
        stored_at: record.stored_at,
    })
}

async fn read_text_field(field_name: &str, field: Field<'_>) -> Result<String, AppError> {
    let value = field.text().await?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::bad_request(format!(
            "multipart field `{}` must not be empty",
            field_name
        )));
    }
    Ok(trimmed.to_string())
}

fn upload_audit_detail(
    original_filename: &str,
    cid: &str,
    encryption_key_id: Option<&str>,
    encrypted_upload: bool,
) -> String {
    match (encrypted_upload, encryption_key_id) {
        (true, Some(key_id)) => format!(
            "Pinned encrypted {} to IPFS as {} using demo key {}",
            original_filename, cid, key_id
        ),
        (true, None) => format!("Pinned encrypted {} to IPFS as {}", original_filename, cid),
        (false, _) => format!("Pinned {} to IPFS as {}", original_filename, cid),
    }
}

fn validate_sha256_hex(sha256_hex: &str) -> Result<String, AppError> {
    let hash_bytes = decode_sha256_hex(sha256_hex)?;
    Ok(hex::encode(hash_bytes))
}

fn decode_sha256_hex(sha256_hex: &str) -> Result<[u8; 32], AppError> {
    let bytes = hex::decode(sha256_hex.trim())
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

fn normalized_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn document_student_name(record: &StoredDocumentRecord) -> Option<String> {
    record.student_name.clone().or_else(|| {
        record
            .note
            .as_deref()
            .and_then(|note| note.strip_prefix("Issued for "))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn student_name_matches(filter: Option<&str>, student_name: Option<&str>) -> bool {
    match filter {
        Some(filter) => student_name
            .map(|student_name| student_name.eq_ignore_ascii_case(filter))
            .unwrap_or(false),
        None => true,
    }
}

fn encrypted_download_filename(original_filename: &str) -> String {
    let base_name = original_filename.strip_suffix(".pdf").unwrap_or(original_filename);
    format!("{}.encrypted.json", base_name)
}
#[cfg(test)]
mod tests {
    use super::{
        decode_sha256_hex, document_student_name, encrypted_download_filename,
        sanitize_filename, student_name_matches, token_matches, upload_audit_detail,
        validate_sha256_hex, validated_filename, MAX_FILENAME_CHARS,
    };
    use crate::models::StoredDocumentRecord;
    use chrono::Utc;

    #[test]
    fn sanitize_filename_replaces_path_separators() {
        assert_eq!(
            sanitize_filename("../unsafe\\name.pdf"),
            ".._unsafe_name.pdf"
        );
    }

    #[test]
    fn token_match_requires_exact_value() {
        assert!(token_matches("secret-token", "secret-token"));
        assert!(!token_matches("secret-token", "secret-token-2"));
        assert!(!token_matches("secret-token", "SECRET-token"));
    }

    #[test]
    fn filename_validation_rejects_overlong_names() {
        let long_name = format!("{}.pdf", "a".repeat(MAX_FILENAME_CHARS + 1));
        assert!(validated_filename(Some(&long_name)).is_err());
    }

    #[test]
    fn filename_validation_rejects_blank_names() {
        assert!(validated_filename(Some("   ")).is_err());
    }

    #[test]
    fn sha256_validation_normalizes_case() {
        let hash = "AB".repeat(32);
        assert_eq!(validate_sha256_hex(&hash).unwrap(), "ab".repeat(32));
    }

    #[test]
    fn sha256_validation_rejects_invalid_length() {
        assert!(decode_sha256_hex("abcd").is_err());
    }

    #[test]
    fn audit_detail_mentions_encryption_key_for_encrypted_uploads() {
        let detail = upload_audit_detail(
            "certificate.pdf",
            "bafybeiexample",
            Some("demo-student-rsa-oaep-2026-03-30-retrieval"),
            true,
        );
        assert!(detail.contains("encrypted"));
        assert!(detail.contains("demo-student-rsa-oaep-2026-03-30-retrieval"));
    }

    #[test]
    fn document_student_name_falls_back_to_issue_note() {
        let record = StoredDocumentRecord {
            document_id: "doc-1".into(),
            student_name: None,
            original_filename: "degree.pdf".into(),
            sha256_hex: "ab".repeat(32),
            ipfs_cid: "bafybeiexample".into(),
            pda: "pda".into(),
            size_bytes: 42,
            stored_at: Utc::now(),
            local_path: "backend/data/uploads/doc-1-degree.encrypted.json".into(),
            encryption_key_id: Some("demo-student-rsa-oaep-2026-03-30-retrieval".into()),
            last_signature: None,
            note: Some("Issued for Rahul Sharma".into()),
        };

        assert_eq!(
            document_student_name(&record).as_deref(),
            Some("Rahul Sharma")
        );
    }

    #[test]
    fn student_name_match_is_case_insensitive() {
        assert!(student_name_matches(
            Some("rahul sharma"),
            Some("Rahul Sharma")
        ));
        assert!(!student_name_matches(Some("ankit"), Some("Rahul Sharma")));
    }

    #[test]
    fn encrypted_download_filename_keeps_base_name() {
        assert_eq!(
            encrypted_download_filename("degree.pdf"),
            "degree.encrypted.json"
        );
    }
}
