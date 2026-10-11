import { object, string, number, z, TypeOf } from 'zod';

const currency = z.enum(['KRW', 'IDR', 'USD']);
const lotBody = object({
  assetClass: string(),
  symbol: string().min(1).max(20).regex(/^[A-Z0-9]+$/, 'Invalid symbol'),
  date: string().datetime({ offset: true }),
  quantity: number().refine((q) => q !== 0, 'Quantity cannot be 0'),
  totalPaid: number(),
  currency,
  note: string().trim().max(120).optional(),
});

export const getPortfolioSchema = object({ query: object({ currency: z.enum(['KRW', 'IDR']), refresh: z.enum(['1']).optional() }) });
export const listLotsSchema = object({ query: object({ assetClass: string().optional() }) });
export const createLotSchema = object({ body: lotBody });
export const updateLotSchema = object({ params: object({ id: string() }), body: lotBody.partial() });
export const lotParamsSchema = object({ params: object({ id: string() }) });
export const putCostSchema = object({
  params: object({ assetClass: string(), symbol: string().min(1).max(20).regex(/^[A-Z0-9]+$/) }),
  body: object({ costAmount: number().min(0).nullable(), costCurrency: currency.optional() })
    .refine((b) => b.costAmount === null || b.costCurrency, 'Currency is required'),
});
export const putBinanceSchema = object({ body: object({ apiKey: string().trim().min(10).max(128), apiSecret: string().trim().min(10).max(128) }) });

export type LotBody = TypeOf<typeof lotBody>;
