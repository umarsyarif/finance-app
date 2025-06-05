import { object, string, number, date, TypeOf, z } from 'zod';

export const createTransactionSchema = object({
  body: object({
    walletId: string({
      required_error: 'Wallet ID is required',
    }),
    categoryId: string({
      required_error: 'Category ID is required',
    }),
    amount: number({
      required_error: 'Amount is required',
    }),
    description: string().optional(),
    date: string({
      required_error: 'Date is required',
    }).refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
  }),
});

export const updateTransactionSchema = object({
  params: object({
    transactionId: string(),
  }),
  body: object({
    walletId: string().optional(),
    categoryId: string().optional(),
    amount: number().optional(),
    description: string().optional(),
    date: string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
  }),
});

export const getTransactionSchema = object({
  params: object({
    transactionId: string(),
  }),
});

export const deleteTransactionSchema = object({
  params: object({
    transactionId: string(),
  }),
});

export const getTransactionsSchema = object({
  query: object({
    walletId: string().optional(),
    categoryId: string().optional(),
    month: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().min(1).max(12).optional()
    ),
    year: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().min(2000).max(2100).optional()
    ),
    page: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().positive().optional()
    ),
    limit: z.preprocess(
      (val) => val ? parseInt(val as string, 10) : undefined,
      z.number().int().positive().optional()
    ),
  }),
});

export type CreateTransactionInput = TypeOf<typeof createTransactionSchema>['body'];
export type UpdateTransactionInput = TypeOf<typeof updateTransactionSchema>;
export type GetTransactionInput = TypeOf<typeof getTransactionSchema>['params'];
export type DeleteTransactionInput = TypeOf<typeof deleteTransactionSchema>['params'];
export type GetTransactionsInput = TypeOf<typeof getTransactionsSchema>['query'];