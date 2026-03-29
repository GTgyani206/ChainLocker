use std::sync::Arc;

use crate::{
    config::AppConfig,
    services::{
        audit::AuditService, ipfs::IpfsService, solana::SolanaService, storage::StorageService,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub storage: StorageService,
    pub audit: AuditService,
    pub ipfs: IpfsService,
    pub solana: SolanaService,
}

impl AppState {
    pub fn new(
        config: AppConfig,
        storage: StorageService,
        audit: AuditService,
        ipfs: IpfsService,
        solana: SolanaService,
    ) -> Self {
        Self {
            config: Arc::new(config),
            storage,
            audit,
            ipfs,
            solana,
        }
    }
}
