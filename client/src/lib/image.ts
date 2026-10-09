// Shrink a photo to at most `maxSize` px on its longest side and re-encode as JPEG,
// so uploads stay small (the API accepts ≤5 MB) and EXIF orientation is applied.
function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unsupported image')); };
    img.src = url;
  });
}

export async function downscaleImage(file: File, maxSize = 1600): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  // Read the size from the image header first so the full-size bitmap is never decoded
  const { naturalWidth, naturalHeight } = await loadImage(file);
  if (!naturalWidth || !naturalHeight) throw new Error('Unsupported image');
  const scale = Math.min(1, maxSize / Math.max(naturalWidth, naturalHeight));
  // EXIF-rotated photos report swapped sizes in some browsers; resize on the long side either way
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
    resizeWidth: Math.max(1, Math.round(naturalWidth * scale)),
    resizeHeight: Math.max(1, Math.round(naturalHeight * scale)),
    resizeQuality: 'high',
  });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');
  context.fillStyle = '#ffffff'; // flatten transparency for JPEG
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
