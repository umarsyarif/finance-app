import { describe, it, expect } from 'vitest';
import { base64UrlToArrayBuffer } from '@/services/biometric.service';

describe('base64UrlToArrayBuffer', () => {
  it('decodes a base64url credential id with - and _ and no padding', () => {
    // bytes fb ff ff 01 → base64 "+///AQ==" → base64url "-___AQ"
    expect([...new Uint8Array(base64UrlToArrayBuffer('-___AQ'))]).toEqual([0xfb, 0xff, 0xff, 0x01]);
  });
});
