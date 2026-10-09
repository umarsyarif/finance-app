// Shrink a photo to at most `maxSize` px on its longest side and re-encode as JPEG,
// so uploads stay small (the API accepts ≤5 MB) and EXIF orientation is applied.
export async function downscaleImage(file: File, maxSize = 1600): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');
  context.fillStyle = '#ffffff'; // flatten transparency for JPEG
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
