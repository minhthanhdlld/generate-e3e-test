import { encryptSecret, decryptSecret } from './crypto.util';
import { randomBytes } from 'crypto';

describe('crypto.util (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.PROJECT_SECRET_KEY = randomBytes(32).toString('base64');
  });

  it('round-trips plaintext', () => {
    const ct = encryptSecret('hunter2');
    expect(ct).not.toContain('hunter2');
    expect(decryptSecret(ct)).toBe('hunter2');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same');
    expect(decryptSecret(b)).toBe('same');
  });

  it('rejects tampered ciphertext', () => {
    const ct = encryptSecret('integrity');
    const buf = Buffer.from(ct, 'base64');
    buf[buf.length - 1] ^= 0x01; // flip a bit in the auth tag
    const tampered = buf.toString('base64');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when key length is wrong', () => {
    const original = process.env.PROJECT_SECRET_KEY;
    process.env.PROJECT_SECRET_KEY = Buffer.from('short').toString('base64');
    try {
      expect(() => encryptSecret('x')).toThrow(/32 bytes/);
    } finally {
      process.env.PROJECT_SECRET_KEY = original;
    }
  });
});
