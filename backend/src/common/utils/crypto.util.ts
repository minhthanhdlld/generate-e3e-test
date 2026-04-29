import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function loadKey(): Buffer {
  const raw = process.env.PROJECT_SECRET_KEY;
  if (!raw) {
    throw new Error('PROJECT_SECRET_KEY is not set');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PROJECT_SECRET_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptSecret expects a string');
  }
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

export function decryptSecret(payload: string): string {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('decryptSecret expects a non-empty base64 string');
  }
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decryptSecret: payload too short');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(buf.length - TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

  // timingSafeEqual is not used to compare inputs here; getAuthTag already
  // gives constant-time tag verification inside Node's GCM implementation.
  void timingSafeEqual;

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
