import { object, string, z, TypeOf } from 'zod';

export const MAX_AVATAR_BYTES = 200 * 1024;

export const putAvatarSchema = object({
  body: object({
    image: string({ required_error: 'Image is required' })
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Image must be base64')
      .refine((b64) => Math.floor((b64.length * 3) / 4) <= MAX_AVATAR_BYTES, 'Image is too large'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }),
});

export type PutAvatarInput = TypeOf<typeof putAvatarSchema>['body'];
