import crypto from 'crypto';

// AES-256-GCM: provides authenticated encryption (AEAD).
// Format: iv_hex:tag_hex:ciphertext_hex (all hex-encoded)
// Legacy CBC format: iv_hex:ciphertext_hex (only one colon) — handled in decrypt for migration.
const ALGO_GCM  = 'aes-256-gcm';
const ALGO_CBC  = 'aes-256-cbc';
const IV_LEN    = 16;
const TAG_LEN   = 16;
const KEY_LEN   = 32;

function getKey(): Buffer {
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production');
  }
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not set');
  }
  // Accept either a 64-character hex string (output of `openssl rand -hex 32`)
  // or a raw 32-character UTF-8 string.
  const isHex = /^[0-9a-fA-F]{64}$/.test(raw);
  const buf   = isHex ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'utf8');
  if (buf.length !== KEY_LEN) {
    throw new Error(`ENCRYPTION_KEY must be 32 raw bytes or 64 hex chars (got ${buf.length} bytes)`);
  }
  if (buf.every(b => b === 0)) {
    throw new Error('ENCRYPTION_KEY must not be a zero key');
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO_GCM, getKey(), iv) as crypto.CipherGCM;
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const parts = stored.split(':');

  // GCM format: iv:tag:ciphertext (3 parts)
  if (parts.length === 3) {
    const iv       = Buffer.from(parts[0], 'hex');
    const tag      = Buffer.from(parts[1], 'hex');
    const enc      = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(ALGO_GCM, getKey(), iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  // Legacy CBC format: iv:ciphertext (2 parts) — kept for migration of old data
  if (parts.length === 2) {
    const iv       = Buffer.from(parts[0], 'hex');
    const enc      = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGO_CBC, getKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  // Not encrypted (plain-text passthrough for backwards-compat during migration)
  return stored;
}
