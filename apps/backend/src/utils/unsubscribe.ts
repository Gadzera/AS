import crypto from 'crypto';
import { config } from '../config';

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function getUnsubscribeUrl(token: string): string {
  return `${config.backend.url}/api/track/unsubscribe/${token}`;
}
