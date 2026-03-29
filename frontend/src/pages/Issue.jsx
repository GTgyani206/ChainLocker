import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineDocumentCheck } from 'react-icons/hi2';
import { issueCredential } from '../api/chainlocker';
import { useToast } from '../components/Toast';
import AnimatedSection from '../components/AnimatedSection';
import './Issue.css';

export default function Issue() {
  const toast = useToast();
  const location = useLocation();

  const [form, setForm] = useState({
    sha256Hex: '',
    ipfsCid: '',
    issuedAtUnix: '',
    note: '',
    dryRun: false,
  });
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState(null);

  // Pre-fill from upload page navigation
  useEffect(() => {
    if (location.state?.sha256Hex) {
      setForm((prev) => ({
        ...prev,
        sha256Hex: location.state.sha256Hex || '',
        ipfsCid: location.state.ipfsCid || '',
        issuedAtUnix: Math.floor(Date.now() / 1000).toString(),
      }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sha256Hex.trim() || !form.ipfsCid.trim()) {
      toast.error('SHA-256 hash and IPFS CID are required');
      return;
    }

    setIssuing(true);
    setResult(null);
    try {
      const data = await issueCredential({
        sha256Hex: form.sha256Hex.trim(),
        ipfsCid: form.ipfsCid.trim(),
        issuedAtUnix: form.issuedAtUnix ? parseInt(form.issuedAtUnix) : null,
        note: form.note.trim() || null,
        dryRun: form.dryRun,
      });
      setResult(data);
      toast.success(
        data.mode === 'preview'
          ? 'Credential prepared in preview mode'
          : 'Credential issued on-chain!'
      );
    } catch (err) {
      toast.error('Issuance failed: ' + err.message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="issue-page page-wrapper">
      <div className="container">
        <AnimatedSection animation="fadeUp">
          <div className="page-header">
            <h1>Issue <span className="gradient-text">Credential</span></h1>
            <p>Submit a document hash and CID to create a verifiable on-chain attestation on Solana.</p>
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fadeUp" delay={0.15}>
          <div className="glass-card issue-card">
            <form onSubmit={handleSubmit} className="issue-form">
              <div className="form-group">
                <label className="form-label">SHA-256 Hash</label>
                <input
                  className="form-input"
                  name="sha256Hex"
                  type="text"
                  placeholder="64 hex characters"
                  value={form.sha256Hex}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">IPFS CID</label>
                <input
                  className="form-input"
                  name="ipfsCid"
                  type="text"
                  placeholder="bafy..."
                  value={form.ipfsCid}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Unix Timestamp</label>
                  <input
                    className="form-input"
                    name="issuedAtUnix"
                    type="number"
                    placeholder="Optional — defaults to now"
                    value={form.issuedAtUnix}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input
                    className="form-input"
                    name="note"
                    type="text"
                    placeholder="Issuance context"
                    value={form.note}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="dryRun"
                  checked={form.dryRun}
                  onChange={handleChange}
                />
                Dry run only (don't submit transaction)
              </label>

              <button className="btn btn-primary" type="submit" disabled={issuing}>
                {issuing ? (
                  <>
                    <div className="spinner"></div>
                    Issuing...
                  </>
                ) : (
                  <>
                    <HiOutlineDocumentCheck />
                    Issue On-Chain
                  </>
                )}
              </button>
            </form>
          </div>
        </AnimatedSection>

        {result && (
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <div className="glass-card result-card">
              <h3>Issuance Result</h3>
              <div className="result-grid">
                <div className="result-item">
                  <span className="result-label">Mode</span>
                  <span className={`status-pill ${result.mode === 'submitted' ? 'status-ok' : 'status-info'}`}>
                    {result.mode}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">SHA-256</span>
                  <code className="hash-text">{result.sha256Hex}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">PDA</span>
                  <code>{result.pda}</code>
                </div>
                {result.signature && (
                  <div className="result-item">
                    <span className="result-label">Transaction Signature</span>
                    <code>{result.signature}</code>
                  </div>
                )}
                {result.explorerUrl && (
                  <div className="result-item">
                    <span className="result-label">Explorer</span>
                    <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer">
                      View on Solana Explorer →
                    </a>
                  </div>
                )}
                {result.note && (
                  <div className="result-item">
                    <span className="result-label">Note</span>
                    <span>{result.note}</span>
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
