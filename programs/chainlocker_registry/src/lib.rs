use anchor_lang::prelude::*;

declare_id!("8HrkFXZUf2CTKT4CP85ecsDV8KNDscB4UHrLni438mVa");

#[program]
pub mod chainlocker_registry {
    use super::*;

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        document_hash: [u8; 32],
        cid: String,
        issued_at: i64,
    ) -> Result<()> {
        require!(
            document_hash.iter().any(|byte| *byte != 0),
            ChainlockerError::InvalidDocumentHash
        );
        require!(
            !cid.trim().is_empty() && cid.len() <= Credential::MAX_CID_BYTES,
            ChainlockerError::InvalidCid
        );
        require!(issued_at > 0, ChainlockerError::InvalidIssuedAt);

        let credential = &mut ctx.accounts.credential;
        credential.document_hash = document_hash;
        credential.cid = cid;
        credential.issuer = ctx.accounts.issuer.key();
        credential.issued_at = issued_at;
        credential.is_revoked = false;
        Ok(())
    }

    pub fn revoke_credential(
        ctx: Context<RevokeCredential>,
        document_hash: [u8; 32],
    ) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        require!(
            credential.document_hash == document_hash,
            ChainlockerError::DocumentHashMismatch
        );
        require!(!credential.is_revoked, ChainlockerError::AlreadyRevoked);

        credential.is_revoked = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(document_hash: [u8; 32])]
pub struct IssueCredential<'info> {
    #[account(
        init,
        payer = issuer,
        space = Credential::SPACE,
        seeds = [document_hash.as_ref()],
        bump
    )]
    pub credential: Account<'info, Credential>,
    #[account(mut)]
    pub issuer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(document_hash: [u8; 32])]
pub struct RevokeCredential<'info> {
    #[account(
        mut,
        seeds = [document_hash.as_ref()],
        bump,
        has_one = issuer @ ChainlockerError::UnauthorizedIssuer
    )]
    pub credential: Account<'info, Credential>,
    pub issuer: Signer<'info>,
}

#[account]
pub struct Credential {
    pub document_hash: [u8; 32],
    pub cid: String,
    pub issuer: Pubkey,
    pub issued_at: i64,
    pub is_revoked: bool,
}

impl Credential {
    pub const MAX_CID_BYTES: usize = 128;
    pub const SPACE: usize = 8 + 32 + 4 + Self::MAX_CID_BYTES + 32 + 8 + 1;
}

#[error_code]
pub enum ChainlockerError {
    #[msg("document hash must not be all zeros")]
    InvalidDocumentHash,
    #[msg("cid must be present and at most 128 bytes")]
    InvalidCid,
    #[msg("issuance timestamp must be positive")]
    InvalidIssuedAt,
    #[msg("credential issuer does not match signer")]
    UnauthorizedIssuer,
    #[msg("document hash does not match the credential account")]
    DocumentHashMismatch,
    #[msg("credential is already revoked")]
    AlreadyRevoked,
}
