import { useRef, useState } from 'react';
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineCheckBadge,
  HiOutlineCloudArrowUp,
  HiOutlineDocumentText,
  HiOutlineUser,
} from 'react-icons/hi2';
import { issueCredential, uploadEncryptedDocument } from '../api/chainlocker';
import { useToast } from '../components/Toast';

export default function UniversityPortal() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [studentName, setStudentName] = useState('');
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState(null);

  const handleIssue = async (event) => {
    event.preventDefault();

    if (!studentName.trim()) {
      toast.error('Enter the student name before issuing the certificate.');
      return;
    }
    if (!file) {
      toast.error('Choose a PDF certificate first.');
      return;
    }

    setIssuing(true);
    setUploadProgress(0);
    setResult(null);

    try {
      const upload = await uploadEncryptedDocument(
        { file, studentName: studentName.trim() },
        setUploadProgress
      );
      const issue = await issueCredential({
        sha256Hex: upload.sha256Hex,
        ipfsCid: upload.ipfsCid,
        note: `Issued for ${studentName.trim()}`,
      });

      setResult({
        studentName: studentName.trim(),
        upload,
        issue,
      });
      toast.success('Certificate issued successfully on Solana devnet.');
    } catch (error) {
      toast.error(`Issuance failed: ${error.message}`);
    } finally {
      setIssuing(false);
    }
  };

  const resetForm = () => {
    setStudentName('');
    setFile(null);
    setUploadProgress(0);
    setResult(null);
  };

  return (
    <section className="portal-page">
      <div className="container portal-grid">
        <div className="portal-copy">
          <p className="portal-section-label">University Portal</p>
          <h2>Issue a tamper-evident certificate in one guided flow.</h2>
          <p>
            The original PDF is hashed locally, encrypted with the demo student
            public key, pinned to IPFS, backed up to Pinata, and then issued on
            Solana Devnet.
          </p>
        </div>

        <div className="glass-card portal-panel">
          <form className="portal-form" onSubmit={handleIssue}>
            <div className="form-group">
              <label className="form-label" htmlFor="studentName">
                Student Name
              </label>
              <div className="portal-input-wrap">
                <HiOutlineUser />
                <input
                  id="studentName"
                  className="form-input"
                  type="text"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Rahul Sharma"
                  autoComplete="off"
                />
              </div>
            </div>

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
                <HiOutlineDocumentText className="portal-file-icon" />
                <span>{file ? file.name : 'Choose PDF certificate'}</span>
              </button>
            </div>

            {issuing ? (
              <div className="portal-progress">
                <div className="portal-progress-bar">
                  <span style={{ width: `${Math.max(uploadProgress, 8)}%` }} />
                </div>
                <p>Uploading encrypted document: {uploadProgress}%</p>
              </div>
            ) : null}

            <div className="portal-actions">
              <button className="btn btn-primary" type="submit" disabled={issuing}>
                {issuing ? (
                  <>
                    <div className="spinner" />
                    Issuing Certificate...
                  </>
                ) : (
                  <>
                    <HiOutlineCloudArrowUp />
                    Issue Certificate
                  </>
                )}
              </button>
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>
        </div>

        {result ? (
          <div className="glass-card portal-result portal-result-success">
            <div className="portal-result-head">
              <span className="status-pill status-ok">
                <HiOutlineCheckBadge />
                Issued
              </span>
              <h3>Certificate issued for {result.studentName}</h3>
            </div>

            <div className="portal-result-grid">
              <div>
                <span className="portal-result-label">Original PDF</span>
                <p>{result.upload.originalFilename}</p>
              </div>
              <div>
                <span className="portal-result-label">Encrypted IPFS CID</span>
                <code>{result.upload.ipfsCid}</code>
              </div>
              <div>
                <span className="portal-result-label">Document Hash</span>
                <code>{result.upload.sha256Hex}</code>
              </div>
              <div>
                <span className="portal-result-label">Issued At</span>
                <p>{new Date(result.issue.issuedAtUnix * 1000).toLocaleString()}</p>
              </div>
            </div>

            {result.issue.explorerUrl ? (
              <a
                className="portal-link"
                href={result.issue.explorerUrl}
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
