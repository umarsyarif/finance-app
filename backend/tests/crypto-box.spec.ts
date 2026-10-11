const KEY = Buffer.alloc(32, 7).toString('base64');
jest.mock('config', () => ({ get: (k: string) => (k === 'assetsEncryptionKey' ? KEY : '') }));

import { encrypt, decrypt, isEncryptionConfigured } from '../src/services/crypto-box';

describe('crypto-box', () => {
  it('round-trips and never stores the plaintext', () => {
    const sealed = encrypt('my-binance-secret');
    expect(sealed.secretEnc).not.toContain('my-binance-secret');
    expect(Buffer.from(sealed.iv, 'base64')).toHaveLength(12);
    expect(decrypt(sealed)).toBe('my-binance-secret');
  });

  it('uses a fresh IV every time', () => {
    expect(encrypt('x').iv).not.toBe(encrypt('x').iv);
  });

  it('rejects a tampered ciphertext', () => {
    const sealed = encrypt('secret');
    const tag = Buffer.from(sealed.authTag, 'base64');
    tag[0] ^= 1;
    expect(() => decrypt({ ...sealed, authTag: tag.toString('base64') })).toThrow();
  });

  it('reports configuration', () => {
    expect(isEncryptionConfigured()).toBe(true);
  });
});
