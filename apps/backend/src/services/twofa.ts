/**
 * 2FA TOTP (M23-1, RFC 6238) на встроенном crypto. Secret шифруется AES-256-GCM (правка GPT).
 * recovery-коды — bcrypt-hash, одноразовые. Никаких внешних зависимостей.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

// ── AES-256-GCM для TOTP-secret (ключ: dedicated env или fallback на jwt.secret — работает в demo) ──
function encKey(): Buffer {
  const dedicated = (process.env.TWO_FACTOR_ENCRYPTION_KEY || '').trim();
  const raw = dedicated || config.jwt.secret;
  // адверс-ревью #3: в production нельзя шифровать TOTP-secret под публично-известным дефолтом.
  if (process.env.NODE_ENV === 'production' && !dedicated && config.jwt.secret === 'change-me-in-production') {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY (or a non-default JWT_SECRET) must be set in production');
  }
  return crypto.createHash('sha256').update(raw).digest();
}
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}
export function decryptSecret(stored: string): string {
  const [ivB, tagB, ctB] = stored.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

// ── base32 (RFC 4648, без паддинга) ──
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160-bit
}

export function otpauthUri(secretB32: string, email: string): string {
  const label = encodeURIComponent(`AISDR:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=AISDR&algorithm=SHA1&digits=6&period=30`;
}

function hotp(keyB32: string, counter: number): string {
  const key = base32Decode(keyB32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

// Текущий TOTP-код (для клиента-теста/диагностики; в проде код вводит пользователь из приложения).
export function totpNow(secretB32: string, atMs = Date.now()): string {
  return hotp(secretB32, Math.floor(atMs / 1000 / 30));
}

// Проверка TOTP-кода с окном ±1 шаг (30с). Возвращает true/false.
export function verifyTotp(secretB32: string, code: string, atMs = Date.now(), window = 1): boolean {
  const c = (code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(atMs / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secretB32, step + w)), Buffer.from(c))) return true;
  }
  return false;
}

// ── recovery-коды ──
export function generateRecoveryCodes(n = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}
export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase().replace(/\s/g, ''), 10);
}
export async function matchRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.toUpperCase().replace(/\s/g, ''), hash);
}
