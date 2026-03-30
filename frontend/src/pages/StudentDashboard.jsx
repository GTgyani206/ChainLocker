import { useMemo, useState } from 'react';
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineCloudArrowDown,
  HiOutlineFolderOpen,
  HiOutlineShieldCheck,
  HiOutlineUserCircle,
} from 'react-icons/hi2';
import { downloadHolderDocument, listHolderDocuments } from '../api/chainlocker';
import { decryptDemoStudentDocument } from '../lib/documentSecurity';
import { useToast } from '../components/Toast';

const DEFAULT_STUDENT_NAME = 'Rahul Sharma';

export default function StudentDashboard() {
  const toast = useToast();
  const [studentName, setStudentName] = useState(DEFAULT_STUDENT_NAME);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retrievingHash, setRetrievingHash] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const summaryText = useMemo(() => {
    if (!hasSearched) {
      return 'Enter the student name used during issuance to retrieve encrypted files.';
    }
    if (loading) {
      return 'Looking up issued files...';
    }
    if (!documents.length) {
      return 'No issued files matched that student name in local storage.';
    }
    return `${documents.length} file${documents.length === 1 ? '' : 's'} ready to retrieve.`;
  }, [documents.length, hasSearched, loading]);

  const handleLookup = async (event) => {
    event.preventDefault();

    if (!studentName.trim()) {
      toast.error('Enter the student name used during issuance.');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const response = await listHolderDocuments(studentName.trim());
      setDocuments(response);
      if (!response.length) {
        toast.error('No issued files were found for that student yet.');
      }
    } catch (error) {
      toast.error(`Could not load files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieve = async (document) => {
    setRetrievingHash(document.sha256Hex);

    try {
      const encryptedBlob = await downloadHolderDocument(document.sha256Hex);
      const decrypted = await decryptDemoStudentDocument(encryptedBlob);
      triggerBrowserDownload(decrypted.blob, decrypted.originalFilename);
      toast.success(`Retrieved ${decrypted.originalFilename}`);
    } catch (error) {
      toast.error(`Could not retrieve file: ${error.message}`);
    } finally {
      setRetrievingHash('');
    }
  };

  return (
    <section className="portal-page">
      <div className="container portal-grid">
        <div className="portal-copy">
          <p className="portal-section-label">Student Dashboard</p>
          <h2>Retrieve issued files without exposing the storage internals.</h2>
          <p>
            The dashboard lists encrypted files issued to the student, downloads the encrypted
            payload, and decrypts it in the browser using the demo holder key.
          </p>
        </div>

        <div className="glass-card portal-panel">
          <form className="portal-form" onSubmit={handleLookup}>
            <div className="form-group">
              <label className="form-label" htmlFor="dashboardStudentName">
                Student Name
              </label>
              <div className="portal-input-wrap">
                <HiOutlineUserCircle />
                <input
                  id="dashboardStudentName"
                  className="form-input"
                  type="text"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Rahul Sharma"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="portal-actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" />
                    Loading Files...
                  </>
                ) : (
                  <>
                    <HiOutlineFolderOpen />
                    Load My Files
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="glass-card portal-result">
          <div className="portal-result-head">
            <span className="status-pill status-ok">
              <HiOutlineShieldCheck />
              Holder Access
            </span>
            <h3>{summaryText}</h3>
          </div>

          {documents.length ? (
            <div className="dashboard-card-list">
              {documents.map((document) => {
                const retrieving = retrievingHash === document.sha256Hex;
                return (
                  <article className="dashboard-card" key={document.sha256Hex}>
                    <div className="dashboard-card-head">
                      <div>
                        <span className="portal-result-label">File</span>
                        <h4>{document.originalFilename}</h4>
                      </div>
                      <span className="status-pill status-info">
                        {document.studentName || 'Holder'}
                      </span>
                    </div>

                    <div className="portal-result-grid">
                      <div>
                        <span className="portal-result-label">Stored</span>
                        <p>{new Date(document.storedAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="portal-result-label">Encrypted CID</span>
                        <code>{document.ipfsCid}</code>
                      </div>
                      <div>
                        <span className="portal-result-label">Document Hash</span>
                        <code>{document.sha256Hex}</code>
                      </div>
                      <div>
                        <span className="portal-result-label">Key ID</span>
                        <p>{document.encryptionKeyId || 'Unavailable'}</p>
                      </div>
                    </div>

                    <div className="portal-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => handleRetrieve(document)}
                        disabled={retrieving}
                      >
                        {retrieving ? (
                          <>
                            <div className="spinner" />
                            Retrieving...
                          </>
                        ) : (
                          <>
                            <HiOutlineCloudArrowDown />
                            Retrieve File
                          </>
                        )}
                      </button>

                      {document.explorerUrl ? (
                        <a
                          className="portal-link"
                          href={document.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <HiOutlineArrowTopRightOnSquare />
                          Explorer
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function triggerBrowserDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
