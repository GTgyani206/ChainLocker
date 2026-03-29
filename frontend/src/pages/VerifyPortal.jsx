import { useRef, useState } from 'react';
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineCheckBadge,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineShieldExclamation,
  HiOutlineXCircle,
} from 'react-icons/hi2';
import { hashFile, verifyCredential } from '../api/chainlocker';
import { useToast } from '../components/Toast';

export default function VerifyPortal() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [browserHash, setBrowserHash] = useState('');

  const handleVerify = async (event) => {
    event.preventDefault();

    if (!file) {
      toast.error('Choose a PDF to verify.');
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      const sha256Hex = await hashFile(file);
      setBrowserHash(sha256Hex);

      const response = await verifyCredential(sha256Hex);
      setResult(response);

      if (response.exists) {
        toast.success('Certificate verified successfully.');
      } else if (response.isRevoked) {
        toast.error('This certificate has been revoked.');
      } else {
        toast.error('The uploaded document is invalid or tampered.');
      }
    } catch (error) {
      toast.error(`Verification failed: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const isAuthentic = result?.exists && result?.isRevoked !== true;

  return (
    <section className="portal-page">
      <div className="container portal-grid">
        <div className="portal-copy">
          <p className="portal-section-label">Verify Portal</p>
          <h2>Check whether a certificate still matches the on-chain record.</h2>
          <p>
            The PDF is hashed in the browser and compared against the immutable
            hash stored on Solana. No wallet interaction is shown to the
            evaluator.
          </p>
        </div>

        <div className="glass-card portal-panel">
          <form className="portal-form" onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label">Certificate PDF</label>
              <button
                type="button"
                className={`portal-file-picker ${file ? 'portal-file-picker-ready' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <HiOutlineDocumentMagnifyingGlass className="portal-file-icon" />
                <span>{file ? file.name : 'Choose PDF certificate'}</span>
              </button>
            </div>

            {browserHash ? (
              <div className="portal-hash-preview">
                <span className="portal-result-label">SHA-256</span>
                <code>{browserHash}</code>
              </div>
            ) : null}

            <div className="portal-actions">
              <button className="btn btn-primary" type="submit" disabled={verifying}>
                {verifying ? (
                  <>
                    <div className="spinner" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <HiOutlineShieldExclamation />
                    Verify Certificate
                  </>
                )}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setFile(null);
                  setBrowserHash('');
                  setResult(null);
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {result ? (
          <div
            className={`glass-card portal-result ${
              isAuthentic ? 'portal-result-success' : 'portal-result-error'
            }`}
          >
            <div className="portal-result-head">
              <span className={`status-pill ${isAuthentic ? 'status-ok' : 'status-error'}`}>
                {isAuthentic ? <HiOutlineCheckBadge /> : <HiOutlineXCircle />}
                {isAuthentic ? 'AUTHENTIC' : 'INVALID'}
              </span>
              <h3>
                {isAuthentic
                  ? 'This document matches the on-chain credential.'
                  : result.isRevoked
                    ? 'This credential was revoked by the issuer.'
                    : 'This document has been tampered with or was never issued.'}
              </h3>
            </div>

            <div className="portal-result-grid">
              <div>
                <span className="portal-result-label">Issuer Address</span>
                <code>{result.issuer || 'Unavailable'}</code>
              </div>
              <div>
                <span className="portal-result-label">Issued Timestamp</span>
                <p>
                  {result.issuedAtUnix
                    ? new Date(result.issuedAtUnix * 1000).toLocaleString()
                    : 'Unavailable'}
                </p>
              </div>
              <div>
                <span className="portal-result-label">Revocation Status</span>
                <p>{result.isRevoked ? 'Revoked' : 'Active'}</p>
              </div>
              <div>
                <span className="portal-result-label">Proof PDA</span>
                <code>{result.pda}</code>
              </div>
            </div>

            {isAuthentic && result.explorerUrl ? (
              <a
                className="portal-link"
                href={result.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                <HiOutlineArrowTopRightOnSquare />
                View Transaction on Solana Explorer
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
