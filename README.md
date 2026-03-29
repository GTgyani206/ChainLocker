# ChainLocker

ChainLocker is a decentralized document attestation demo: a university uploads a certificate, the original PDF hash is stored on Solana Devnet, the encrypted document blob is stored on IPFS and backed up to Pinata, and an employer can verify authenticity without contacting the issuer.

## Live Solana Program

- Program ID: `8HrkFXZUf2CTKT4CP85ecsDV8KNDscB4UHrLni438mVa`
- Explorer: <https://explorer.solana.com/address/8HrkFXZUf2CTKT4CP85ecsDV8KNDscB4UHrLni438mVa?cluster=devnet>

## Actual Architecture

- `programs/chainlocker_registry/`
  Anchor program on Solana Devnet storing `document_hash`, `cid`, `issuer`, `issued_at`, and `is_revoked`.
- `backend/`
  Rust + Axum API for uploads, IPFS/Pinata integration, live on-chain issuance, and verification.
- `frontend/`
  React + Vite UI with exactly two evaluator-facing pages: University Portal and Verify Portal.
- `ipfs`
  Local Kubo/IPFS daemon installed on the machine and pointed at a repo-local `.ipfs/` data directory during the demo.

## Upload and Verify Flow

1. The browser hashes the original PDF with SHA-256.
2. The browser encrypts the PDF with the demo student public key.
3. The encrypted blob is uploaded to Kubo and backed up to Pinata.
4. The original SHA-256 hash and encrypted CID are issued on Solana Devnet.
5. The Verify Portal hashes the uploaded PDF in-browser and checks the on-chain record.

## Start Locally

Start services in this order from the project root:

1. Kubo daemon

```powershell
$env:IPFS_PATH="$PWD\.ipfs"
if (-not (Test-Path $env:IPFS_PATH)) { ipfs init }
ipfs daemon
```

2. Rust backend

```powershell
cargo run --manifest-path backend/Cargo.toml
```

3. Frontend

```powershell
Set-Location frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## Portal URLs

- University Portal: <http://127.0.0.1:5173/>
- Verify Portal: <http://127.0.0.1:5173/verify>

## Notes

- Backend default bind: `http://127.0.0.1:3001`
- Kubo RPC API: `http://127.0.0.1:5001/api/v0`
- Demo admin token is attached silently by the frontend; no wallet or admin UI is shown to evaluators.
