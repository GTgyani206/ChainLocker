use std::{path::PathBuf, str::FromStr};

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Deserialize;
use serde_json::json;
use solana_sdk::{
    hash::Hash,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::{read_keypair_file, Signer},
    system_program,
    transaction::Transaction,
};

use crate::{
    config::SolanaConfig,
    error::AppError,
    models::ServiceHealth,
};

#[derive(Clone)]
pub struct SolanaService {
    config: SolanaConfig,
    client: reqwest::Client,
}

#[derive(Debug, Clone)]
pub struct OnChainCredential {
    pub exists: bool,
    pub pda: String,
    pub issuer: Option<String>,
    pub cid: Option<String>,
    pub issued_at_unix: Option<i64>,
    pub is_revoked: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct IssuanceResult {
    pub pda: String,
    pub signature: Option<String>,
    pub mode: String,
}

#[derive(Debug, Deserialize)]
struct RpcEnvelope<T> {
    result: Option<T>,
    error: Option<RpcErrorObject>,
}

#[derive(Debug, Deserialize)]
struct RpcErrorObject {
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
struct LatestBlockhashResponse {
    value: LatestBlockhashValue,
}

#[derive(Debug, Deserialize)]
struct LatestBlockhashValue {
    blockhash: String,
}

#[derive(Debug, Deserialize)]
struct AccountInfoResponse {
    value: Option<AccountInfoValue>,
}

#[derive(Debug, Deserialize)]
struct AccountInfoValue {
    data: (String, String),
}

impl SolanaService {
    pub fn new(config: SolanaConfig, client: reqwest::Client) -> Self {
        Self { config, client }
    }

    pub async fn health(&self) -> Result<ServiceHealth, String> {
        self.latest_blockhash()
            .await
            .map(|_| ServiceHealth {
                reachable: true,
                detail: "rpc reachable".into(),
            })
            .map_err(|error| format!("{:?}", error))
    }

    pub fn derive_pda(&self, hash: &[u8; 32]) -> Result<Pubkey, AppError> {
        let program_id = self.program_id()?;
        let (pda, _) = Pubkey::find_program_address(&[hash.as_ref()], &program_id);
        Ok(pda)
    }

    pub async fn verify_credential(&self, hash: [u8; 32]) -> Result<OnChainCredential, AppError> {
        let pda = self.derive_pda(&hash)?;
        let result: AccountInfoResponse = self
            .rpc(
                "getAccountInfo",
                json!([pda.to_string(), { "encoding": "base64", "commitment": "confirmed" }]),
            )
            .await?;

        let Some(account) = result.value else {
            return Ok(OnChainCredential {
                exists: false,
                pda: pda.to_string(),
                issuer: None,
                cid: None,
                issued_at_unix: None,
                is_revoked: None,
            });
        };

        let raw = BASE64
            .decode(account.data.0.as_bytes())
            .map_err(|error| AppError::upstream_logged("failed to decode account data", error))?;
        let parsed = parse_credential(&raw)?;

        Ok(OnChainCredential {
            exists: true,
            pda: pda.to_string(),
            issuer: Some(parsed.issuer.to_string()),
            cid: Some(parsed.cid),
            issued_at_unix: Some(parsed.issued_at_unix),
            is_revoked: Some(parsed.is_revoked),
        })
    }

    pub async fn issue_credential(
        &self,
        hash: [u8; 32],
        cid: String,
        issued_at_unix: i64,
        dry_run: bool,
    ) -> Result<IssuanceResult, AppError> {
        let pda = self.derive_pda(&hash)?.to_string();
        if dry_run {
            return Err(AppError::bad_request(
                "dryRun is disabled; live on-chain issuance is required",
            ));
        }

        let keypair_path = self.config.issuer_keypair.clone().ok_or_else(|| {
            AppError::internal("issuer keypair is not configured for live on-chain issuance")
        })?;

        let recent_blockhash = self.latest_blockhash().await?;
        let program_id = self.program_id()?;
        let serialized = tokio::task::spawn_blocking(move || {
            build_signed_transaction(
                program_id,
                keypair_path,
                hash,
                cid,
                issued_at_unix,
                recent_blockhash,
            )
        })
        .await
        .map_err(|error| AppError::internal_logged("internal server error", error))??;

        let signature: String = self
            .rpc(
                "sendTransaction",
                json!([
                    BASE64.encode(serialized),
                    { "encoding": "base64", "preflightCommitment": "confirmed" }
                ]),
            )
            .await?;

        Ok(IssuanceResult {
            pda,
            signature: Some(signature),
            mode: "submitted".into(),
        })
    }

    pub fn explorer_tx_url(&self, signature: &str) -> String {
        match self.config.cluster.as_str() {
            "mainnet" | "mainnet-beta" => format!("https://explorer.solana.com/tx/{}", signature),
            cluster => format!(
                "https://explorer.solana.com/tx/{}?cluster={}",
                signature, cluster
            ),
        }
    }

    async fn latest_blockhash(&self) -> Result<Hash, AppError> {
        let response: LatestBlockhashResponse = self
            .rpc("getLatestBlockhash", json!([{ "commitment": "confirmed" }]))
            .await?;
        Hash::from_str(&response.value.blockhash)
            .map_err(|error| AppError::upstream_logged("failed to parse blockhash", error))
    }

    async fn rpc<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T, AppError> {
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let response = self
            .client
            .post(&self.config.rpc_url)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::upstream(format!(
                "solana rpc returned {}",
                response.status()
            )));
        }

        let envelope: RpcEnvelope<T> = response.json().await?;
        match (envelope.result, envelope.error) {
            (Some(result), None) => Ok(result),
            (_, Some(error)) => Err(AppError::upstream_logged(
                format!("solana rpc {} failed", method),
                format!("{} ({})", error.message, error.code),
            )),
            _ => Err(AppError::upstream("solana rpc returned an empty response")),
        }
    }

    fn program_id(&self) -> Result<Pubkey, AppError> {
        self.config
            .program_id
            .parse::<Pubkey>()
            .map_err(|error| AppError::bad_request(format!("invalid Solana program id: {}", error)))
    }
}

fn build_signed_transaction(
    program_id: Pubkey,
    keypair_path: PathBuf,
    hash: [u8; 32],
    cid: String,
    issued_at_unix: i64,
    recent_blockhash: Hash,
) -> Result<Vec<u8>, AppError> {
    let issuer = read_keypair_file(&keypair_path).map_err(|error| {
        AppError::bad_request(format!("failed to read issuer keypair: {}", error))
    })?;
    let issuer_pubkey = issuer.pubkey();
    let (pda, _) = Pubkey::find_program_address(&[hash.as_ref()], &program_id);
    let accounts = chainlocker_registry::accounts::IssueCredential {
        credential: pda,
        issuer: issuer_pubkey,
        system_program: system_program::id(),
    };
    let data = chainlocker_registry::instruction::IssueCredential {
        document_hash: hash,
        cid,
        issued_at: issued_at_unix,
    }
    .data();

    let instruction = Instruction {
        program_id,
        accounts: accounts.to_account_metas(None),
        data,
    };

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&issuer_pubkey),
        &[&issuer],
        recent_blockhash,
    );

    bincode::serialize(&transaction)
        .map_err(|error| AppError::internal_logged("failed to serialize transaction", error))
}

struct ParsedCredential {
    cid: String,
    issuer: Pubkey,
    issued_at_unix: i64,
    is_revoked: bool,
}

fn parse_credential(data: &[u8]) -> Result<ParsedCredential, AppError> {
    let mut slice = data;
    let credential = chainlocker_registry::Credential::try_deserialize(&mut slice)
        .map_err(|error| AppError::upstream_logged("failed to parse credential account", error))?;

    Ok(ParsedCredential {
        cid: credential.cid,
        issuer: credential.issuer,
        issued_at_unix: credential.issued_at,
        is_revoked: credential.is_revoked,
    })
}

#[cfg(test)]
mod tests {
    use anchor_lang::{AccountSerialize, Discriminator};
    use solana_sdk::pubkey::Pubkey;

    use super::parse_credential;

    #[test]
    fn parse_credential_accepts_valid_layout() {
        let credential = chainlocker_registry::Credential {
            document_hash: [9_u8; 32],
            cid: "bafybeigdyrzt5examplecidvalue".to_string(),
            issuer: Pubkey::new_unique(),
            issued_at: 1_700_000_000_i64,
            is_revoked: false,
        };

        let mut data = Vec::new();
        data.extend_from_slice(&chainlocker_registry::Credential::DISCRIMINATOR);
        credential
            .try_serialize(&mut data)
            .expect("serialize test credential");

        let parsed = parse_credential(&data).expect("valid account layout");
        assert_eq!(parsed.cid, credential.cid);
        assert_eq!(parsed.issuer, credential.issuer);
        assert_eq!(parsed.issued_at_unix, credential.issued_at);
        assert!(!parsed.is_revoked);
    }

    #[test]
    fn parse_credential_rejects_short_accounts() {
        assert!(parse_credential(&[0_u8; 12]).is_err());
    }
}
