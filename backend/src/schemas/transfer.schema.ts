import { object, string, number, TypeOf } from 'zod';
import { MAX_AMOUNT } from './transaction.schema';

const amount = () => number().positive('Amount must be greater than 0').max(MAX_AMOUNT, 'Amount is too large');

const body = object({
  fromWalletId: string({ required_error: 'From wallet is required' }),
  toWalletId: string({ required_error: 'To wallet is required' }),
  amountSent: amount(),
  amountReceived: amount().optional(),
  date: string({ required_error: 'Date is required' }).datetime({ offset: true, message: 'Invalid date format' }),
  note: string().max(255, 'Note is too long').optional(),
});

const params = object({ transferId: string() });

export const createTransferSchema = object({ body });
export const updateTransferSchema = object({ params, body });
export const transferParamsSchema = object({ params });

export type TransferBody = TypeOf<typeof body>;
export type TransferParams = TypeOf<typeof params>;
