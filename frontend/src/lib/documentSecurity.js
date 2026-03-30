const DEMO_STUDENT_KEY_ID = 'demo-student-rsa-oaep-2026-03-30-retrieval';
const DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT =
  'e24fe2bf2a6582c0969805046ba2915e159083e034c0d6a5f4d221cc2ef74418';

// Demo holder keypair used for the evaluator build on 2026-03-30.
// The public key encrypts the uploaded PDF before it is stored on IPFS/Pinata.
// The matching private key is embedded only to support the demo student dashboard
// so the holder can retrieve and decrypt issued files in-browser.
// Never ship a browser-side private key in production.
const DEMO_STUDENT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3pOt2S+qmDpBPFUDJkyZ
8TzZ5X/Qw/+h9y4ftEwjShA11uZ6rZ/9NEYFZ80SN4uILeqnfxeskm+K75M5CvHr
5zp/Nn4CKwCaiYZKXaSLmETEoCZ+Bmn+MFU7GOlfnu4UouylU2/F3nog1Q5K+bDH
VAS/bAnkHhggzJAL/EsTL9WmUZ2sPhp4oKITF970nN6zjNOs31sox2JJImpclmp1
6PjD9AnWb9Ir4BIJKDEmnB4KgxNDURd6T+Lg7uoVIfedZj7+3jxT8d2eYf4EcTrv
PCACt8fgZ0OEiVIx5o0ROwrFCUTeM8BYuxbeNKNSPiT8npVSBt+B/kZopRTn0j+R
GQIDAQAB
-----END PUBLIC KEY-----`;

const DEMO_STUDENT_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDek63ZL6qYOkE8
VQMmTJnxPNnlf9DD/6H3Lh+0TCNKEDXW5nqtn/00RgVnzRI3i4gt6qd/F6ySb4rv
kzkK8evnOn82fgIrAJqJhkpdpIuYRMSgJn4Gaf4wVTsY6V+e7hSi7KVTb8XeeiDV
Dkr5sMdUBL9sCeQeGCDMkAv8SxMv1aZRnaw+GnigohMX3vSc3rOM06zfWyjHYkki
alyWanXo+MP0CdZv0ivgEgkoMSacHgqDE0NRF3pP4uDu6hUh951mPv7ePFPx3Z5h
/gRxOu88IAK3x+BnQ4SJUjHmjRE7CsUJRN4zwFi7Ft40o1I+JPyelVIG34H+Rmil
FOfSP5EZAgMBAAECggEAA+PI0gGHQF8kQg2qScJk86urPduHUSWSiw3/TS4CH9/l
+6TOLWKdEODNugwCGX5oGYVUUAr138lF6vyZA/FJEiLE6QrittBX4wy5wqaG2gO5
pqLa6PnJO3GsirmUC48ARVNQFa6KYreiWJbbWz8U/LQ93tbSvxk6LtkFnJnN8rQH
etV4kzCl+319fi+cmH8cQD/bmj3iPVs3zqqtUCdCIUGrT1mtTzWvmVcv5eFPkK0g
f0ibfb9AslYhNaA7WV9zaXn4uFWGuhriZ1gVP+9kRf3g7RiEs7oLM8nxmKnRRTlX
SDzgIyzePdm6joLXihovPQryrmOh0p9INDTEyEiNEQKBgQDvCHCEVQGnRu14wdgn
A0MIswl/zP4+ZStSdfGLn2smy6OELWNBqd+g8Ma1T1yPGuGxZTo7CmtL6Bu3hPBp
vKzzWpE8tv/DxDklcfoba3LQFHLSSamKrwZnx4NhZnPRnU+eF/N6QmJiwFI8+n4v
KB2YQqp/BgzSudnXCWVj90yuywKBgQDuYDWh841hQ3jHaNpfTt7aYREjXSHMwFyN
WV1nIXyQRB7h+DMZfg0I6swYARdS0FrIL8e5EoBsCd2dZhOta9F+B37GtEtgR4IW
F7E5yD78RnzaiAV+yrLFn5PLcoVLwFBY9I+XyYFoHCcvCBAdgrgd5pq34ehkjmJm
gm84OIb/KwKBgB0XQdpZHiJll3Ei5lOZKgddAsLzB95AIc2fXQ5JEJlgHz5u562O
JxFHPGfEiNdBxkX4s+WLlxNd5EGphDjaJZJYa2SgQPBqaSoNfQrpQMfiNTcyj9e5
BWaL+YlZFq9kHdR3xcITYjXygg+5zLGgiDmHo4hiDB15UPHCyvwnlMWRAoGAZJ4p
pU2XnLmNLqa8nkQ9XvJf+IxkKvf7WRKikViaKo8Gdh18/EKvn9b0BSHYxXT7DMrW
Q/FiUbgsWjbvEWGUUN07DwalVmN4rnibrycuJvBd3SRTJXzLzw0XpmWVjC8F+zZn
sgs1W0ue4oRFwR8fNkfTgNCTdnZ/ZIOkDJgXq3cCgYEAus1Ytj8iOJzfoPPPNXmj
aSKospN3RRImdibF7HT7GlpotNhnyfbF3saOEqGRbx1m6Xi/UzGPK1SlmmPgFxbV
6o843j2n+7V5pa3B6eZslDWamY1jOispFJ2lzveH6sXwwF49I1hNYHn6LqE9hqIs
dssX6+UOnmuk9wAs5AdZIXI=
-----END PRIVATE KEY-----`;

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
  const encryptedFile = new File([encryptedBlob], toEncryptedFilename(file.name), {
    type: ENCRYPTED_BLOB_TYPE,
  });

  return {
    sha256Hex,
    encryptedFile,
    encryptionKeyId: DEMO_STUDENT_KEY_ID,
    encryptionKeyFingerprint: DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT,
  };
}

export async function decryptDemoStudentDocument(encryptedBlob) {
  const payload = await parseEncryptedPayload(encryptedBlob);
  const keyId = payload?.encryption?.keyId;
  if (keyId !== DEMO_STUDENT_KEY_ID) {
    throw new Error(
      `This document uses ${keyId || 'an unknown key'}, but the demo dashboard only supports ${DEMO_STUDENT_KEY_ID}.`
    );
  }

  const privateKey = await importDemoStudentPrivateKey();
  const wrappedKey = base64ToBytes(payload.wrappedKey);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);

  const originalFilename = payload.originalFilename || 'document.pdf';
  const mimeType = payload.originalMimeType || 'application/pdf';
  const bytes = new Uint8Array(plaintext);
  const blob = new Blob([bytes], { type: mimeType });

  return {
    originalFilename,
    mimeType,
    studentName: payload.studentName || 'Demo Student',
    blob,
    bytes,
    file: new File([blob], originalFilename, { type: mimeType }),
  };
}

async function parseEncryptedPayload(blob) {
  const text = typeof blob === 'string' ? blob : await blob.text();
  const payload = JSON.parse(text);

  if (
    !payload?.wrappedKey ||
    !payload?.iv ||
    !payload?.ciphertext ||
    !payload?.encryption?.keyId
  ) {
    throw new Error('The downloaded file is not a valid ChainLocker encrypted document.');
  }

  return payload;
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

async function importDemoStudentPrivateKey() {
  const der = pemToArrayBuffer(DEMO_STUDENT_PRIVATE_KEY_PEM, 'PRIVATE KEY');
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
}

function pemToArrayBuffer(pem, label = 'PUBLIC KEY') {
  const base64 = pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
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

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toEncryptedFilename(originalFilename) {
  const baseName = originalFilename.replace(/\.pdf$/i, '');
  return `${baseName || 'document'}.encrypted.json`;
}

export {
  DEMO_STUDENT_KEY_ID,
  DEMO_STUDENT_PUBLIC_KEY_FINGERPRINT,
  ENCRYPTED_BLOB_TYPE,
};
