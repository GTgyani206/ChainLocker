use std::{
    env,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    time::Duration,
};

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub storage: StorageConfig,
    pub ipfs: IpfsConfig,
    pub solana: SolanaConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub bind_addr: SocketAddr,
    pub max_upload_bytes: usize,
    pub cors_allow_origin: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    pub root_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpfsConfig {
    pub api_url: String,
    pub pin: bool,
    pub pinata_api_key: Option<String>,
    pub pinata_secret_key: Option<String>,
    pub pinata_jwt: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolanaConfig {
    pub rpc_url: String,
    pub program_id: String,
    pub cluster: String,
    pub issuer_keypair: Option<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct SecurityConfig {
    pub admin_token: Option<String>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid environment variable {name}: {reason}")]
    Invalid { name: String, reason: String },
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let host = env_string("CHAINLOCKER_BIND_HOST").unwrap_or_else(|| "0.0.0.0".to_string());
        let port = env_u16("CHAINLOCKER_BIND_PORT").unwrap_or(8080);
        let max_upload_mb = env_usize("CHAINLOCKER_MAX_UPLOAD_MB").unwrap_or(64);

        let bind_host = host.parse::<IpAddr>().map_err(|err| ConfigError::Invalid {
            name: "CHAINLOCKER_BIND_HOST".into(),
            reason: err.to_string(),
        })?;

        Ok(Self {
            server: ServerConfig {
                bind_addr: SocketAddr::new(bind_host, port),
                max_upload_bytes: max_upload_mb * 1024 * 1024,
                cors_allow_origin: env_string("CHAINLOCKER_CORS_ALLOW_ORIGIN")
                    .unwrap_or_else(|| "http://localhost:8080".into()),
            },
            storage: StorageConfig {
                root_dir: PathBuf::from(
                    env_string("CHAINLOCKER_STORAGE_DIR")
                        .unwrap_or_else(|| "./backend/data".into()),
                ),
            },
            ipfs: IpfsConfig {
                api_url: env_string("CHAINLOCKER_IPFS_API_URL")
                    .unwrap_or_else(|| "http://127.0.0.1:5001/api/v0".into()),
                pin: env_bool("CHAINLOCKER_IPFS_PIN").unwrap_or(true),
                pinata_api_key: env_string("PINATA_API_KEY").filter(|value| !value.is_empty()),
                pinata_secret_key: env_string("PINATA_SECRET_KEY")
                    .filter(|value| !value.is_empty()),
                pinata_jwt: env_string("PINATA_JWT")
                    .or_else(|| env_string("JWT"))
                    .filter(|value| !value.is_empty()),
            },
            solana: SolanaConfig {
                rpc_url: env_string("CHAINLOCKER_SOLANA_RPC_URL")
                    .unwrap_or_else(|| "https://api.devnet.solana.com".into()),
                program_id: env_string("CHAINLOCKER_SOLANA_PROGRAM_ID")
                    .unwrap_or_else(|| "8HrkFXZUf2CTKT4CP85ecsDV8KNDscB4UHrLni438mVa".into()),
                cluster: env_string("CHAINLOCKER_SOLANA_CLUSTER")
                    .unwrap_or_else(|| "devnet".into()),
                issuer_keypair: env_string("CHAINLOCKER_ISSUER_KEYPAIR")
                    .filter(|value| !value.is_empty())
                    .map(PathBuf::from),
            },
            security: SecurityConfig {
                admin_token: env_string("CHAINLOCKER_ADMIN_TOKEN")
                    .filter(|value| !value.is_empty()),
            },
        })
    }

    pub fn http_timeout(&self) -> Duration {
        Duration::from_secs(30)
    }
}

fn env_string(name: &str) -> Option<String> {
    env::var(name).ok()
}

fn env_usize(name: &str) -> Option<usize> {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
}

fn env_u16(name: &str) -> Option<u16> {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
}

fn env_bool(name: &str) -> Option<bool> {
    env::var(name)
        .ok()
        .and_then(|value| match value.to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        })
}
