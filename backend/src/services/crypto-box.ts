import crypto from 'crypto';
import config from 'config';

// AES-256-GCM for secrets at rest (the Binance API secret). The key lives only in the server env.
export type Sealed = { secretEnc: string; iv: string; authTag: string };

const key = () => {
  const raw = config.get<string>('assetsEncryptionKey');
  const buf = Buffer.from(raw || '', 'base64');
  if (buf.length !== 32) throw new Error('ASSETS_ENCRYPTION_KEY must be 32 bytes, base64');
  return buf;
};

export const isEncryptionConfigured = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

export function encrypt(plain: string): Sealed {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { secretEnc: enc.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

export function decrypt(s: Sealed): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(s.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(s.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(s.secretEnc, 'base64')), decipher.final()]).toString('utf8');
}
