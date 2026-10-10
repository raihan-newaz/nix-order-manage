import crypto from 'crypto';
import { config } from '../config';

export const MASKED_SECRET = '••••••••';
const ENCRYPTED_PREFIX = 'enc:v1:';
const encryptionKey = crypto.createHash('sha256').update(config.dataEncryptionKey).digest();

export const protectSecret = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const revealSecret = (value?: string | null): string => {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value || '';
  const [ivPart, tagPart, encryptedPart] = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Stored secret is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64')), decipher.final()]).toString('utf8');
};

export const maskSecret = (value?: string | null) => value ? MASKED_SECRET : null;
export const keepExistingSecret = (incoming: unknown, existing?: string | null) =>
  incoming === undefined || incoming === MASKED_SECRET
    ? existing ?? undefined
    : protectSecret(String(incoming).trim() || null);

export const isAllowedRemoteUrl = (value: unknown, allowHttp = false): boolean => {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '0.0.0.0' || hostname === '::1') return false;
    if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;
    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return false;
    if (/^169\.254\./.test(hostname)) return false;
    return true;
  } catch { return false; }
};

export const safeEqualBase64Hmac = (body: Buffer, secret: string, signature: string) => {
  const expected = crypto.createHmac('sha256', revealSecret(secret)).update(body).digest('base64');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
