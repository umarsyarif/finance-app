import { object, string, number, boolean, z } from 'zod';

const billBody = object({
  name: string().trim().min(1, 'Name is required').max(60),
  amount: number().positive('Amount must be more than 0').lt(1e15, 'Amount is too large'),
  currency: z.enum(['KRW', 'IDR']),
  walletId: string().uuid().nullable().optional(),
  categoryId: string().uuid().nullable().optional(),
  dayOfMonth: number().int().min(1).max(31),
  remindDaysBefore: z.union([z.literal(0), z.literal(1), z.literal(3)]),
  active: boolean().optional(),
});
export const createBillSchema = object({ body: billBody });
export const updateBillSchema = object({ params: object({ id: string() }), body: billBody.partial() });
export const billParamsSchema = object({ params: object({ id: string() }) });
