// Shrink a photo to at most `maxSize` px on its longest side and re-encode as JPEG,
// so uploads stay small (the API accepts ≤5 MB). Decoding via <img> lets the browser
// apply EXIF orientation to both the reported size and the drawn pixels.
function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    return img.decode().then(() => img).catch(() => { throw new Error('Unsupported image'); });
  }
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unsupported image'));
  });
}

export async function downscaleImage(file: File, maxSize = 1600): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) throw new Error('Unsupported image');
    const scale = Math.min(1, maxSize / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not supported');
    context.fillStyle = '#ffffff'; // flatten transparency for JPEG
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
