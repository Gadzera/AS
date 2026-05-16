import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

export const redis = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

export const outreachQueue = new Queue('outreach', { connection: redis });
