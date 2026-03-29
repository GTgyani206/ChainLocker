use std::path::PathBuf;

use tokio::{fs, io::AsyncWriteExt};

use crate::{error::AppError, models::AuditEvent};

#[derive(Clone)]
pub struct AuditService {
    log_path: PathBuf,
}

impl AuditService {
    pub fn new(log_path: PathBuf) -> Self {
        Self { log_path }
    }

    pub async fn append(&self, event: AuditEvent) -> Result<(), AppError> {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .await?;
        let line = serde_json::to_string(&event)?;
        file.write_all(line.as_bytes()).await?;
        file.write_all(b"\n").await?;
        Ok(())
    }

    pub async fn recent(&self, limit: usize) -> Result<Vec<AuditEvent>, AppError> {
        let content = match fs::read_to_string(&self.log_path).await {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };

        let mut entries = content
            .lines()
            .filter_map(|line| serde_json::from_str::<AuditEvent>(line).ok())
            .collect::<Vec<_>>();
        let keep_from = entries.len().saturating_sub(limit);
        Ok(entries.split_off(keep_from))
    }
}
