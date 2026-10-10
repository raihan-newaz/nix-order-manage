import dotenv from 'dotenv';
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const builderStorefrontOrigin = (process.env.BUILDER_STOREFRONT_ORIGIN || (isDev ? 'http://localhost:3001' : '')).replace(/\/$/, '');
if (builderStorefrontOrigin) {
  const url = new URL(builderStorefrontOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== builderStorefrontOrigin) throw new Error('BUILDER_STOREFRONT_ORIGIN must be an HTTP(S) origin without a path or credentials');
}
const jwtSecret = process.env.JWT_SECRET || (isDev ? 'development-only-change-me-nix-2026' : '');
if (!jwtSecret || (!isDev && jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a unique value of at least 32 characters in production');
}
const dataEncryptionKey = process.env.DATA_ENCRYPTION_KEY || (isDev ? jwtSecret : '');
if (!dataEncryptionKey || (!isDev && dataEncryptionKey.length < 32)) {
  throw new Error('DATA_ENCRYPTION_KEY must be set to a unique value of at least 32 characters in production');
}

const configuredClientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const developmentClientUrls = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

export const config = {
  builderStorefrontOrigin,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  jwtSecret,
  dataEncryptionKey,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: Array.from(new Set([
    ...configuredClientUrls,
    ...(isDev ? developmentClientUrls : []),
  ])),
  isDev,
  cookieName: 'nix_session',
  customerCookieName: 'nix_customer_session',
};
