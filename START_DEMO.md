# Start Demo

Follow these steps in this order on demo day.

## 1. Start Kubo daemon

From the project root:

```powershell
$env:IPFS_PATH="$PWD\.ipfs"
if (-not (Test-Path $env:IPFS_PATH)) { ipfs init }
ipfs daemon
```

Wait for `Daemon is ready`.

## 2. Start Rust backend

Open a second terminal in the project root:

```powershell
cargo run --manifest-path backend/Cargo.toml
```

Wait for `chainlocker backend listening on 0.0.0.0:3001`.

## 3. Start frontend

Open a third terminal:

```powershell
Set-Location frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## 4. Open University Portal and Verify Portal side by side

- University Portal: `http://127.0.0.1:5173/`
- Verify Portal: `http://127.0.0.1:5173/verify`

## 5. Upload a fresh PDF as the university and note the Explorer link

- Enter the student name.
- Upload the PDF in University Portal.
- Click `Issue Certificate`.
- Copy the Solana Explorer transaction link from the success card.

## 6. Switch to Verify Portal and upload the same PDF

- Upload the exact same original PDF.
- Confirm the result shows `AUTHENTIC`.

## 7. Tamper the PDF and upload it again

- Edit the PDF content slightly and save it as a new file.
- Upload the tampered file to Verify Portal.
- Confirm the result shows `INVALID`.
