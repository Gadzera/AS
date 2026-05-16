import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:3000'),

  db: {
    url: optional('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/aisdr'),
  },

  jwt: {
    secret: process.env.NODE_ENV === 'production'
      ? required('JWT_SECRET')
      : optional('JWT_SECRET', 'dev-only-secret-change-in-production'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  ai: {
    apiKey: optional('ANTHROPIC_API_KEY', ''),
  },

  apollo: {
    apiKey: optional('APOLLO_API_KEY', ''),
    baseUrl: 'https://api.apollo.io',
  },

  unipile: {
    apiKey: optional('UNIPILE_API_KEY', ''),
    dsn: optional('UNIPILE_DSN', ''),
  },

  stripe: {
    secretKey: optional('STRIPE_SECRET_KEY', ''),
    webhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
    prices: {
      starter: optional('STRIPE_PRICE_STARTER', ''),
      growth: optional('STRIPE_PRICE_GROWTH', ''),
      agency: optional('STRIPE_PRICE_AGENCY', ''),
    },
  },

  smtp: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'SDR Agent <noreply@yourdomain.com>'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  backend: {
    url: optional('BACKEND_URL', 'http://localhost:3001'),
  },

  calendly: {
    url: optional('CALENDLY_URL', ''),
  },

  imap: {
    host: optional('IMAP_HOST', 'imap.gmail.com'),
    port: parseInt(optional('IMAP_PORT', '993'), 10),
  },

  pdl: {
    apiKey: optional('PDL_API_KEY', ''),
  },

  bannerbear: {
    apiKey: optional('BANNERBEAR_API_KEY', ''),
  },

  hubspot: {
    accessToken: optional('HUBSPOT_ACCESS_TOKEN', ''),
  },

  pipedrive: {
    apiKey: optional('PIPEDRIVE_API_KEY', ''),
    domain: optional('PIPEDRIVE_DOMAIN', ''),
  },
};
