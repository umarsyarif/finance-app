import { object, string, number, z, TypeOf } from 'zod';

const currency = z.enum(['KRW', 'IDR', 'USD']);
const lotBody = object({
  assetClass: string(),
  symbol: string().min(1).max(20).regex(/^[A-Z0-9]+$/, 'Invalid symbol'),
  date: string().datetime({ offset: true }),
  quantity: number().refine((q) => q !== 0, 'Quantity cannot be 0').refine((q) => Math.abs(q) < 1e16, 'Quantity is too large'),
  totalPaid: number().refine((v) => Math.abs(v) < 1e15, 'Amount is too large'),
  currency,
  note: string().trim().max(120).optional(),
});

export const getPortfolioSchema = object({ query: object({ currency: z.enum(['KRW', 'IDR']), refresh: z.enum(['1']).optional() }) });
export const listLotsSchema = object({ query: object({ assetClass: string().optional() }) });
const sameSign = (b: { quantity?: number; totalPaid?: number }) =>
  b.quantity === undefined || b.totalPaid === undefined || b.totalPaid === 0 || Math.sign(b.quantity) === Math.sign(b.totalPaid);
const SIGN_MSG = 'Quantity and amount must have the same sign';
export const createLotSchema = object({ body: lotBody.refine(sameSign, SIGN_MSG) });
export const updateLotSchema = object({ params: object({ id: string() }), body: lotBody.partial().refine(sameSign, SIGN_MSG) });
export const lotParamsSchema = object({ params: object({ id: string() }) });
export const putCostSchema = object({
  params: object({ assetClass: string(), symbol: string().min(1).max(20).regex(/^[A-Z0-9]+$/) }),
  body: object({ costAmount: number().min(0).max(1e15 - 1).nullable(), costCurrency: currency.optional() })
    .refine((b) => b.costAmount === null || b.costCurrency, 'Currency is required'),
});
export const putBinanceSchema = object({ body: object({ apiKey: string().trim().min(10).max(128), apiSecret: string().trim().min(10).max(128) }) });

export type LotBody = TypeOf<typeof lotBody>;
