const DEMO_STUDENT_KEY_ID = 'demo-student-rsa-oaep-2026-03-30';
const DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT =
  '39724e61476d18e66b569dfce3985748bf46ea8e5150ea685b2d4f2da10fde32';

// Demo encryption keypair used for the evaluator build on 2026-03-30.
// This public key encrypts the document before it is uploaded to IPFS/Pinata.
// Key ID: demo-student-rsa-oaep-2026-03-30
// SHA-256 fingerprint of the PEM public key:
// 39724e61476d18e66b569dfce3985748bf46ea8e5150ea685b2d4f2da10fde32
// The matching private key must stay offline and out of the browser/runtime.
const DEMO_STUDENT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp6MS8AtKycU9nYnEqKrV
loCUuaLb2tE4r9yh4dKvV4AUNfnQq4/OXM0K7hmaPn6xUJrzrmz8ZX2qJxI2w7ww
Z5ayX3Gu9oZ6P/yd5/Jak6OZX4mOqOQIWreGDSOJR83eWMsIR7EFbNxZSGcizESk
Mq22dhwQ93FGT4fjH7G+X3/Jh3Y6kO1cJN33mWw/JX0Rw2eb4uzB9lBSYwiGRStj
Q+KIgfBRfSJWoRjB5D4vQRrQeOuYtKQMoS28pkeeRmOyNFM2/q/kMH7erPuPJYmj
kRdBx/c9HabWpXE9O58x6MFhZikG1Vic9do+XiEyKeQ1nrAfg1P073MDHEO+UzcC
fQIDAQAB
-----END PUBLIC KEY-----`;

const ENCRYPTED_BLOB_TYPE = 'application/vnd.chainlocker.encrypted+json';

export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  return hashArrayBuffer(buffer);
}

export async function encryptPdfForDemoStudent(file, studentName) {
  const originalBytes = await file.arrayBuffer();
  const sha256Hex = await hashArrayBuffer(originalBytes);

  const publicKey = await importDemoStudentPublicKey();
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    originalBytes
  );
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  );

  const payload = {
    version: 'chainlocker-encrypted-document/v1',
    originalFilename: file.name,
    originalMimeType: file.type || 'application/pdf',
    studentName: studentName?.trim() || 'Demo Student',
    createdAt: new Date().toISOString(),
    encryption: {
      scheme: 'AES-256-GCM + RSA-OAEP-256',
      keyId: DEMO_STUDENT_KEY_ID,
      publicKeyFingerprint: DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT,
    },
    wrappedKey: bytesToBase64(new Uint8Array(encryptedKey)),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };

  const encryptedBlob = new Blob([JSON.stringify(payload, null, 2)], {
    type: ENCRYPTED_BLOB_TYPE,
  });
  const encryptedFile = new File(
    [encryptedBlob],
    toEncryptedFilename(file.name),
    { type: ENCRYPTED_BLOB_TYPE }
  );

  return {
    sha256Hex,
    encryptedFile,
    encryptionKeyId: DEMO_STUDENT_KEY_ID,
    encryptionKeyFingerprint: DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT,
  };
}

async function hashArrayBuffer(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function importDemoStudentPublicKey() {
  const der = pemToArrayBuffer(DEMO_STUDENT_PUBLIC_KEY_PEM);
  return crypto.subtle.importKey(
    'spki',
    der,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function toEncryptedFilename(originalFilename) {
  const baseName = originalFilename.replace(/\.pdf$/i, '');
  return `${baseName || 'document'}.encrypted.json`;
}

export {
  DEMO_STUDENT_KEY_ID,
  DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT,
  DEMO_STUDENT_PUBLIC_KEY_PEM,
  ENCRYPTED_BLOB_TYPE,
};
