import { useState, useRef } from 'react';
import { HiOutlineShieldCheck, HiOutlineDocumentMagnifyingGlass } from 'react-icons/hi2';
import { verifyCredential, hashFile } from '../api/chainlocker';
import { useToast } from '../components/Toast';
import AnimatedSection from '../components/AnimatedSection';
import './Verify.css';

export default function Verify() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [browserHash, setBrowserHash] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleVerify = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setVerifying(true);
    setResult(null);
    setBrowserHash('');

    try {
      // Hash in browser
      const sha256Hex = await hashFile(file);
      setBrowserHash(sha256Hex);

      // Verify against chain
      const data = await verifyCredential(sha256Hex);
      setResult(data);

      if (data.exists) {
        toast.success('Credential found on Solana!');
      } else {
        toast.info('No on-chain credential found for this document');
      }
    } catch (err) {
      toast.error('Verification failed: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="verify-page page-wrapper">
      <div className="container">
        <AnimatedSection animation="fadeUp">
          <div className="page-header">
            <h1>Verify <span className="gradient-text">Document</span></h1>
            <p>Hash a file in your browser using Web Crypto and check the Solana ledger for a matching credential.</p>
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fadeUp" delay={0.15}>
          <div className="glass-card verify-card">
            <div
              className={`dropzone ${dragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => e.target.files[0] && setFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              {file ? (
                <div className="file-preview">
                  <HiOutlineDocumentMagnifyingGlass className="file-icon" />
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">Ready to verify</span>
                  </div>
                </div>
              ) : (
                <>
                  <HiOutlineShieldCheck className="dropzone-icon" />
                  <p className="dropzone-text">Drop a document to verify</p>
                  <p className="dropzone-hint">The file is hashed locally — it never leaves your browser</p>
                </>
              )}
            </div>

            <div className="upload-actions">
              <button
                className="btn btn-primary"
                onClick={handleVerify}
                disabled={!file || verifying}
              >
                {verifying ? (
                  <>
                    <div className="spinner"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <HiOutlineShieldCheck />
                    Hash & Verify
                  </>
                )}
              </button>
              {file && !verifying && (
                <button className="btn btn-ghost" onClick={() => { setFile(null); setResult(null); setBrowserHash(''); }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </AnimatedSection>

        {result && (
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <div className={`glass-card result-card ${result.exists ? 'verified' : 'not-verified'}`}>
              <div className="verify-status-header">
                <div className={`verify-badge ${result.exists ? 'badge-verified' : 'badge-missing'}`}>
                  <HiOutlineShieldCheck />
                  {result.exists ? 'Credential Verified' : 'Not Found'}
                </div>
              </div>

              <div className="result-grid">
                <div className="result-item">
                  <span className="result-label">Browser-Computed SHA-256</span>
                  <code className="hash-text">{browserHash}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">Solana PDA</span>
                  <code>{result.pda}</code>
                </div>
                {result.issuer && (
                  <div className="result-item">
                    <span className="result-label">Issuer</span>
                    <code>{result.issuer}</code>
                  </div>
                )}
                {result.issuedAtUnix && (
                  <div className="result-item">
                    <span className="result-label">Issued At</span>
                    <span>{new Date(result.issuedAtUnix * 1000).toLocaleString()}</span>
                  </div>
                )}
                {result.localRecord && (
                  <div className="result-item">
                    <span className="result-label">IPFS CID (Local Record)</span>
                    <code>{result.localRecord.ipfsCid}</code>
                  </div>
                )}
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
