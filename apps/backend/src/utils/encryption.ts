import crypto from 'crypto';

const ALGO      = 'aes-256-cbc';
const IV_LEN    = 16;
const KEY_LEN   = 32;
const SEPARATOR = ':';

const DEV_FALLBACK_KEY = 'dev-fallback-key-change-in-prod!';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? DEV_FALLBACK_KEY;
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production');
  }
  return Buffer.from(raw.padEnd(KEY_LEN, '0').slice(0, KEY_LEN), 'utf8');
}

export function encrypt(plaintext: string): string {
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}${SEPARATOR}${enc.toString('hex')}`;
}

/**
 * Decrypts "iv_hex:ciphertext_hex" → plaintext.
 * Returns input unchanged if it doesn't look encrypted (backwards-compat).
 */
export function decrypt(stored: string): string {
  if (!stored.includes(SEPARATOR)) return stored; // plain-text fallback
  try {
    const [ivHex, encHex] = stored.split(SEPARATOR);
    const iv       = Buffer.from(ivHex, 'hex');
    const enc      = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return stored; // if decryption fails, return as-is
  }
}
