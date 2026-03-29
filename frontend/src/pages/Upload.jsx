import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineCloudArrowUp, HiOutlineDocument } from 'react-icons/hi2';
import { uploadEncryptedDocument } from '../api/chainlocker';
import { useToast } from '../components/Toast';
import AnimatedSection from '../components/AnimatedSection';
import './Upload.css';

export default function Upload() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    setUploading(true);
    setProgress(0);
    setResult(null);
    try {
      const data = await uploadEncryptedDocument(
        { file, studentName: 'Demo Student' },
        setProgress
      );
      setResult(data);
      toast.success('Encrypted document uploaded and pinned to IPFS!');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const goToIssue = () => {
    if (result) {
      navigate('/issue', { state: { sha256Hex: result.sha256Hex, ipfsCid: result.ipfsCid } });
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="upload-page page-wrapper">
      <div className="container">
        <AnimatedSection animation="fadeUp">
          <div className="page-header">
            <h1>Upload & <span className="gradient-text">Pin</span></h1>
            <p>Hash the original PDF locally, encrypt it for the demo student key, then pin only the encrypted blob to IPFS.</p>
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fadeUp" delay={0.15}>
          <div className="glass-card upload-card">
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
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.json,.txt,.doc,.docx"
                style={{ display: 'none' }}
              />
              {file ? (
                <div className="file-preview">
                  <HiOutlineDocument className="file-icon" />
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatBytes(file.size)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <HiOutlineCloudArrowUp className="dropzone-icon" />
                  <p className="dropzone-text">Drop your document here or click to browse</p>
                  <p className="dropzone-hint">Supports PDF, PNG, JPG, JSON, TXT, DOC files</p>
                </>
              )}
            </div>

            {uploading && (
              <div className="progress-bar-wrapper">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                <span className="progress-label">{progress}%</span>
              </div>
            )}

            <div className="upload-actions">
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <div className="spinner"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <HiOutlineCloudArrowUp />
                    Encrypt & Pin to IPFS
                  </>
                )}
              </button>
              {file && !uploading && (
                <button className="btn btn-ghost" onClick={() => { setFile(null); setResult(null); }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </AnimatedSection>

        {result && (
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <div className="glass-card result-card">
              <h3>Upload Result</h3>
              <div className="result-grid">
                <div className="result-item">
                  <span className="result-label">Document ID</span>
                  <code>{result.documentId}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">SHA-256</span>
                  <code className="hash-text">{result.sha256Hex}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">IPFS CID</span>
                  <code>{result.ipfsCid}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">Solana PDA</span>
                  <code>{result.pda}</code>
                </div>
                <div className="result-item">
                  <span className="result-label">File Size</span>
                  <span>{formatBytes(result.sizeBytes)}</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={goToIssue} style={{ marginTop: 'var(--space-lg)' }}>
                Issue Credential →
              </button>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
