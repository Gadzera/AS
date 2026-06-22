/**
 * M17-4: org-scoped зашифрованный secret store для workflow-интеграций (AES-256-GCM).
 * value НИКОГДА не отдаётся наружу (list возвращает только метаданные). Ссылка в config — {{secret.<key>}}.
 * Ключ шифрования — из env WORKFLOW_SECRET_ENCRYPTION_KEY (sha256 → 32 байта). Нет ключа → операции
 * честно бросают SecretsUnavailableError (приложение НЕ падает; вызывающий помечает шаг/endpoint FAILED).
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export class SecretsUnavailableError extends Error {
  constructor() { super('Secret store unavailable: WORKFLOW_SECRET_ENCRYPTION_KEY is not configured'); this.name = 'SecretsUnavailableError'; }
}

export function secretsAvailable(): boolean {
  return !!config.workflow.secretEncryptionKey;
}

function encKey(): Buffer {
  if (!config.workflow.secretEncryptionKey) throw new SecretsUnavailableError();
  return crypto.createHash('sha256').update(config.workflow.secretEncryptionKey, 'utf8').digest(); // 32 байта
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decrypt(stored: string): string {
  const [ivB, tagB, ctB] = stored.split('.');
  if (!ivB || !tagB || !ctB) throw new Error('Malformed encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

// Имя секрета: буквы/цифры/_/. (используется в {{secret.NAME}}).
export const SECRET_KEY_RE = /^[A-Za-z0-9_.]{1,64}$/;

export interface SecretMeta { key: string; createdById: string | null; createdAt: Date; updatedAt: Date }

/** Создать/перезаписать (rotate) секрет. Бросает SecretsUnavailableError если нет env-ключа. */
export async function setSecret(orgId: string, key: string, value: string, createdById: string | null): Promise<SecretMeta> {
  if (!SECRET_KEY_RE.test(key)) throw new Error('Invalid secret key (allowed: A-Z a-z 0-9 _ . , up to 64 chars)');
  const valueEncrypted = encrypt(value); // бросит, если store недоступен
  const row = await prisma.workflowSecret.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, valueEncrypted, createdById },
    update: { valueEncrypted },
    select: { key: true, createdById: true, createdAt: true, updatedAt: true },
  });
  return row;
}

/** Список секретов org — ТОЛЬКО метаданные, без value. */
export async function listSecrets(orgId: string): Promise<SecretMeta[]> {
  return prisma.workflowSecret.findMany({ where: { orgId }, orderBy: { key: 'asc' }, select: { key: true, createdById: true, createdAt: true, updatedAt: true } });
}

export async function deleteSecret(orgId: string, key: string): Promise<boolean> {
  const r = await prisma.workflowSecret.deleteMany({ where: { orgId, key } });
  return r.count > 0;
}

/** Резолв одного секрета в plaintext (ТОЛЬКО для внутреннего исполнения; не логировать!). null если нет. */
export async function resolveSecret(orgId: string, key: string): Promise<string | null> {
  if (!secretsAvailable()) return null;
  const row = await prisma.workflowSecret.findUnique({ where: { orgId_key: { orgId, key } }, select: { valueEncrypted: true } });
  if (!row) return null;
  try { return decrypt(row.valueEncrypted); } catch { return null; }
}

/** Карта всех секретов org в plaintext (для template-резолвера HTTP-блока). Пустая, если store недоступен. */
export async function loadSecretMap(orgId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!secretsAvailable()) return map;
  const rows = await prisma.workflowSecret.findMany({ where: { orgId }, select: { key: true, valueEncrypted: true } });
  for (const r of rows) { try { map.set(r.key, decrypt(r.valueEncrypted)); } catch { /* битый секрет — пропускаем */ } }
  return map;
}
