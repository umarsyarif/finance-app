import { describe, it, expect, vi } from 'vitest';
import { base64UrlToArrayBuffer, biometricService } from '@/services/biometric.service';

describe('base64UrlToArrayBuffer', () => {
  it('decodes a base64url credential id with - and _ and no padding', () => {
    // bytes fb ff ff 01 → base64 "+///AQ==" → base64url "-___AQ"
    expect([...new Uint8Array(base64UrlToArrayBuffer('-___AQ'))]).toEqual([0xfb, 0xff, 0xff, 0x01]);
  });
});

describe('legacy sign-in enrollment', () => {
  it('never counts as an app lock and is removed', () => {
    const store: Record<string, string> = {
      biometric_credential: JSON.stringify({ id: 'x', publicKey: '', counter: 0 }),
      biometric_user_id: 'u1',
    };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      removeItem: (k: string) => { delete store[k]; },
    });
    expect(biometricService.isEnabled()).toBe(false);
    expect(store).toEqual({});
    vi.unstubAllGlobals();
  });
});
