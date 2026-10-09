import { object, string, z, TypeOf } from 'zod';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const captureTextSchema = object({
  body: object({
    text: string({ required_error: 'Text is required' })
      .trim()
      .min(1, 'Text is required')
      .max(8000, 'Text is too long (max 8,000 characters)'),
  }),
});

export const capturePhotoSchema = object({
  body: object({
    image: string({ required_error: 'Image is required' })
      .min(1, 'Image is required')
      .refine((b64) => Buffer.byteLength(b64, 'base64') <= MAX_IMAGE_BYTES, 'Image is too large (max 5 MB)'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
      errorMap: () => ({ message: 'Use a JPEG, PNG or WebP image' }),
    }),
  }),
});

export type CaptureTextInput = TypeOf<typeof captureTextSchema>['body'];
export type CapturePhotoInput = TypeOf<typeof capturePhotoSchema>['body'];
