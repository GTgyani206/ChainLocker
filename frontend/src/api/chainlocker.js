import axios from 'axios';
import { encryptPdfForDemoStudent, hashFile } from '../lib/documentSecurity';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const DEMO_ADMIN_TOKEN = import.meta.env.VITE_CHAINLOCKER_ADMIN_TOKEN || 'change-me';

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30000,
});

// Evaluator-facing pages do not expose auth. The demo admin token is attached silently.
let adminToken = sessionStorage.getItem('chainlocker.adminToken') || DEMO_ADMIN_TOKEN;

export function setAdminToken(token) {
  adminToken = token || DEMO_ADMIN_TOKEN;
  sessionStorage.setItem('chainlocker.adminToken', adminToken);
}

export function getAdminToken() {
  return adminToken;
}

// Request interceptor to attach admin token
client.interceptors.request.use((config) => {
  if (adminToken) {
    config.headers['x-chainlocker-admin-token'] = adminToken;
  }
  return config;
});

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// Health check
export async function getHealth() {
  return client.get('/health');
}

// System config (admin)
export async function getSystemConfig() {
  return client.get('/system/config');
}

// Activity log (admin)
export async function getActivity(limit = 12) {
  return client.get('/system/activity', { params: { limit } });
}

// Upload document (admin)
export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  return client.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
      : undefined,
  });
}

// Upload an encrypted document while preserving the original PDF hash for on-chain issuance.
export async function uploadEncryptedDocument({ file, studentName }, onProgress) {
  const { sha256Hex, encryptedFile, encryptionKeyId } = await encryptPdfForDemoStudent(
    file,
    studentName
  );

  const formData = new FormData();
  formData.append('file', encryptedFile);
  formData.append('sha256Hex', sha256Hex);
  formData.append('originalFilename', file.name);
  formData.append('encryptionKeyId', encryptionKeyId);

  return client.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || 1)))
      : undefined,
  });
}

// Issue credential (admin)
export async function issueCredential({ sha256Hex, ipfsCid, issuedAtUnix, note, dryRun }) {
  return client.post('/credentials/issue', {
    sha256Hex,
    ipfsCid,
    issuedAtUnix: issuedAtUnix || null,
    note: note || null,
    dryRun: dryRun || false,
  });
}

// Verify credential (public)
export async function verifyCredential(sha256Hex) {
  return client.post('/credentials/verify', { sha256Hex });
}

// Browser-side SHA-256 hashing
export default client;
export { hashFile };
