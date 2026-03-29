use std::path::{Path, PathBuf};

use tokio::{fs, io::AsyncWriteExt};

use crate::{config::StorageConfig, error::AppError, models::StoredDocumentRecord};

#[derive(Clone)]
pub struct StorageService {
    uploads_dir: PathBuf,
    records_dir: PathBuf,
    audit_log_path: PathBuf,
}

impl StorageService {
    pub async fn new(config: &StorageConfig) -> Result<Self, AppError> {
        let root_dir = config.root_dir.clone();
        let uploads_dir = root_dir.join("uploads");
        let records_dir = root_dir.join("records");
        let audit_log_path = root_dir.join("audit.log");

        fs::create_dir_all(&uploads_dir).await?;
        fs::create_dir_all(&records_dir).await?;

        Ok(Self {
            uploads_dir,
            records_dir,
            audit_log_path,
        })
    }

    pub fn uploads_dir(&self) -> &Path {
        &self.uploads_dir
    }

    pub fn audit_log_path(&self) -> &Path {
        &self.audit_log_path
    }

    pub async fn save_record(&self, record: &StoredDocumentRecord) -> Result<(), AppError> {
        let path = self.record_path(&record.sha256_hex);
        let payload = serde_json::to_vec_pretty(record)?;
        let mut file = fs::File::create(path).await?;
        file.write_all(&payload).await?;
        Ok(())
    }

    pub async fn load_record(
        &self,
        sha256_hex: &str,
    ) -> Result<Option<StoredDocumentRecord>, AppError> {
        let path = self.record_path(sha256_hex);
        let content = match fs::read(path).await {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        Ok(Some(serde_json::from_slice::<StoredDocumentRecord>(
            &content,
        )?))
    }

    pub async fn update_record_signature(
        &self,
        sha256_hex: &str,
        signature: Option<String>,
        note: Option<String>,
    ) -> Result<(), AppError> {
        let Some(mut record) = self.load_record(sha256_hex).await? else {
            return Ok(());
        };

        record.last_signature = signature;
        if note.is_some() {
            record.note = note;
        }
        self.save_record(&record).await
    }

    fn record_path(&self, sha256_hex: &str) -> PathBuf {
        self.records_dir.join(format!("{}.json", sha256_hex))
    }
}
