import { object, string, number, array, TypeOf } from 'zod';
import { MAX_AMOUNT } from './transaction.schema';

const balance = () => number().min(-MAX_AMOUNT).max(MAX_AMOUNT);

export const createWalletSchema = object({
  body: object({
    name: string({
      required_error: 'Wallet name is required',
    }),
    currency: string({
      required_error: 'Currency is required',
    }),
    balance: balance().default(0),
    color: string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').default('#3B82F6'),
  }),
});

export const updateWalletSchema = object({
  params: object({
    walletId: string(),
  }),
  body: object({
    name: string().optional(),
    currency: string().optional(),
    balance: balance().optional(),
    color: string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  }),
});

export const getWalletSchema = object({
  params: object({
    walletId: string(),
  }),
});

export const updateWalletOrderSchema = object({
  body: object({
    walletOrders: array(
      object({
        id: string(),
        displayOrder: number().int().min(0),
      })
    ).min(1),
  }),
});

export const deleteWalletSchema = object({
  params: object({
    walletId: string(),
  }),
});

export const getWalletsSchema = object({
  query: object({
    currency: string().optional(),
  }),
});

export type CreateWalletInput = TypeOf<typeof createWalletSchema>['body'];
export type UpdateWalletInput = TypeOf<typeof updateWalletSchema>;
export type GetWalletInput = TypeOf<typeof getWalletSchema>['params'];
export type DeleteWalletInput = TypeOf<typeof deleteWalletSchema>['params'];
export type GetWalletsInput = TypeOf<typeof getWalletsSchema>['query'];