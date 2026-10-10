import { describe, it, expect, vi, beforeEach } from 'vitest';
import { squareAvatar } from '@/lib/image';

const drawImage = vi.fn();
const fillRect = vi.fn();
beforeEach(() => {
  drawImage.mockClear();
  fillRect.mockClear();
  // 400x300 source image
  vi.stubGlobal('Image', class {
    width = 400; height = 300; naturalWidth = 400; naturalHeight = 300;
    src = '';
    decode() { return Promise.resolve(); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, fillRect } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD');
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
});

describe('squareAvatar', () => {
  it('centre-crops to a square and draws it at 256x256 as JPEG', async () => {
    const out = await squareAvatar(new File(['x'], 'p.png', { type: 'image/png' }));
    expect(out).toEqual({ image: 'QUJD', mimeType: 'image/jpeg' });
    // source crop: 300x300 starting at x=50
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 300, 300, 0, 0, 256, 256);
    // white background first, so transparent PNGs don't turn black in the JPEG
    expect(fillRect).toHaveBeenCalledWith(0, 0, 256, 256);
    expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(drawImage.mock.invocationCallOrder[0]);
  });
});
