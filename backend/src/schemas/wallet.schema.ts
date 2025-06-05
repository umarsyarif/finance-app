import { object, string, number, TypeOf } from 'zod';

export const createWalletSchema = object({
  body: object({
    name: string({
      required_error: 'Wallet name is required',
    }),
    currency: string({
      required_error: 'Currency is required',
    }),
    balance: number({
      required_error: 'Initial balance is required',
    }).default(0),
  }),
});

export const updateWalletSchema = object({
  params: object({
    walletId: string(),
  }),
  body: object({
    name: string().optional(),
    currency: string().optional(),
    balance: number().optional(),
  }),
});

export const getWalletSchema = object({
  params: object({
    walletId: string(),
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