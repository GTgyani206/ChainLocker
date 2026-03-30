use std::path::Path;

use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use tokio::{fs::File, io::BufReader};
use tokio_util::io::ReaderStream;
use tracing::{info, warn};

use crate::{config::IpfsConfig, error::AppError, models::ServiceHealth};

const PINATA_PIN_BY_HASH_URL: &str = "https://api.pinata.cloud/pinning/pinByHash";
const PINATA_PIN_FILE_URL: &str = "https://api.pinata.cloud/pinning/pinFileToIPFS";

#[derive(Clone)]
pub struct IpfsService {
    config: IpfsConfig,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
struct AddResponse {
    #[serde(rename = "Hash")]
    hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PinataPinByHashRequest<'a> {
    hash_to_pin: &'a str,
    pinata_metadata: PinataMetadata<'a>,
}

#[derive(Debug, Serialize)]
struct PinataMetadata<'a> {
    name: &'a str,
}

#[derive(Debug, Deserialize, Serialize)]
struct PinataPinFileResponse {
    #[serde(rename = "IpfsHash")]
    ipfs_hash: String,
    #[serde(rename = "PinSize")]
    pin_size: u64,
    #[serde(rename = "Timestamp")]
    timestamp: String,
    #[serde(rename = "isDuplicate")]
    is_duplicate: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct IpfsAddResult {
    pub cid: String,
}

impl IpfsService {
    pub fn new(config: IpfsConfig, client: reqwest::Client) -> Self {
        Self { config, client }
    }

    pub async fn health(&self) -> Result<ServiceHealth, String> {
        let url = format!("{}/version", self.config.api_url.trim_end_matches('/'));
        let response = self
            .client
            .post(url)
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if response.status().is_success() {
            Ok(ServiceHealth {
                reachable: true,
                detail: "kubo api reachable".into(),
            })
        } else {
            Ok(ServiceHealth {
                reachable: false,
                detail: format!("kubo api returned {}", response.status()),
            })
        }
    }

    pub async fn add_file(
        &self,
        path: &Path,
        original_filename: &str,
    ) -> Result<IpfsAddResult, AppError> {
        let file = File::open(path).await?;
        let stream = ReaderStream::new(BufReader::new(file));
        let body = reqwest::Body::wrap_stream(stream);
        let mime = mime_guess::from_path(original_filename).first_or_octet_stream();
        let part = Part::stream(body)
            .file_name(original_filename.to_string())
            .mime_str(mime.essence_str())
            .map_err(|error| AppError::bad_request(error.to_string()))?;

        let form = Form::new().part("file", part);
        let url = format!(
            "{}/add?pin={}&cid-version=1&stream-channels=true",
            self.config.api_url.trim_end_matches('/'),
            self.config.pin
        );

        let response = self
            .client
            .post(url)
            .multipart(form)
            .send()
            .await
            .map_err(|error| {
                AppError::upstream_logged(
                    format!(
                        "cannot reach IPFS API at {} (start Kubo/IPFS Desktop daemon)",
                        self.config.api_url
                    ),
                    error,
                )
            })?;
        if !response.status().is_success() {
            return Err(AppError::upstream(format!(
                "ipfs add failed with {} (api: {})",
                response.status(),
                self.config.api_url
            )));
        }

        let payload: AddResponse = response.json().await?;
        self.pin_cid_to_pinata(path, &payload.hash, original_filename)
            .await;
        Ok(IpfsAddResult { cid: payload.hash })
    }

    pub async fn cat_cid(&self, cid: &str) -> Result<Vec<u8>, AppError> {
        let url = format!(
            "{}/cat?arg={}",
            self.config.api_url.trim_end_matches('/'),
            cid
        );
        let response = self.client.post(url).send().await.map_err(|error| {
            AppError::upstream_logged(
                format!(
                    "cannot reach IPFS API at {} (start Kubo/IPFS Desktop daemon)",
                    self.config.api_url
                ),
                error,
            )
        })?;

        if !response.status().is_success() {
            return Err(AppError::upstream(format!(
                "ipfs cat failed with {} (api: {})",
                response.status(),
                self.config.api_url
            )));
        }

        Ok(response.bytes().await?.to_vec())
    }

    async fn pin_cid_to_pinata(&self, path: &Path, cid: &str, original_filename: &str) {
        if let Some(jwt) = self.config.pinata_jwt.as_ref() {
            self.pin_file_to_pinata(jwt, path, cid, original_filename)
                .await;
            return;
        }

        let (Some(api_key), Some(secret_key)) = (
            self.config.pinata_api_key.as_ref(),
            self.config.pinata_secret_key.as_ref(),
        ) else {
            warn!(
                cid,
                "PINATA_JWT or PINATA_API_KEY/PINATA_SECRET_KEY is not configured; skipping Pinata backup pin"
            );
            return;
        };

        let payload = PinataPinByHashRequest {
            hash_to_pin: cid,
            pinata_metadata: PinataMetadata {
                name: original_filename,
            },
        };

        let response = match self
            .client
            .post(PINATA_PIN_BY_HASH_URL)
            .header("pinata_api_key", api_key)
            .header("pinata_secret_api_key", secret_key)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => response,
            Err(error) => {
                warn!(cid, error = %error, "Pinata backup pin request failed");
                return;
            }
        };

        let status = response.status();
        let detail = response
            .text()
            .await
            .unwrap_or_else(|_| "unable to read Pinata response".into());

        if status.is_success() {
            info!(
                cid,
                pinata_response = %detail,
                "Pinata backup pin succeeded"
            );
            return;
        }

        warn!(
            cid,
            detail = %detail,
            "Pinata backup pin was rejected"
        );
    }

    async fn pin_file_to_pinata(
        &self,
        jwt: &str,
        path: &Path,
        cid: &str,
        original_filename: &str,
    ) {
        let file = match File::open(path).await {
            Ok(file) => file,
            Err(error) => {
                warn!(cid, error = %error, "Failed to reopen file for Pinata backup upload");
                return;
            }
        };
        let stream = ReaderStream::new(BufReader::new(file));
        let body = reqwest::Body::wrap_stream(stream);
        let mime = mime_guess::from_path(original_filename).first_or_octet_stream();
        let part = match Part::stream(body)
            .file_name(original_filename.to_string())
            .mime_str(mime.essence_str())
        {
            Ok(part) => part,
            Err(error) => {
                warn!(cid, error = %error, "Failed to build Pinata multipart upload");
                return;
            }
        };

        let form = Form::new()
            .part("file", part)
            .text(
                "pinataMetadata",
                format!(r#"{{"name":"{}"}}"#, original_filename),
            )
            .text("pinataOptions", r#"{"cidVersion":1}"#.to_string());

        let response = match self
            .client
            .post(PINATA_PIN_FILE_URL)
            .bearer_auth(jwt)
            .multipart(form)
            .send()
            .await
        {
            Ok(response) => response,
            Err(error) => {
                warn!(cid, error = %error, "Pinata file upload request failed");
                return;
            }
        };

        let status = response.status();
        let detail = response
            .text()
            .await
            .unwrap_or_else(|_| "unable to read Pinata response".into());

        if !status.is_success() {
            warn!(
                cid,
                detail = %detail,
                "Pinata file upload was rejected"
            );
            return;
        }

        let parsed: PinataPinFileResponse = match serde_json::from_str(&detail) {
            Ok(parsed) => parsed,
            Err(error) => {
                warn!(
                    cid,
                    detail = %detail,
                    error = %error,
                    "Pinata file upload succeeded but response parsing failed"
                );
                return;
            }
        };

        if parsed.ipfs_hash != cid {
            warn!(
                cid,
                pinata_cid = %parsed.ipfs_hash,
                pinata_response = %detail,
                "Pinata uploaded the file but returned a different CID"
            );
            return;
        }

        info!(
            cid,
            pinata_response = %detail,
            "Pinata backup pin succeeded"
        );
    }
}
