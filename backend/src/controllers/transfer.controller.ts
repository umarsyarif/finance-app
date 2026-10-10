import { Request, Response, NextFunction } from 'express';
import type { TransferBody, TransferParams } from '../schemas/transfer.schema';
import { createTransfer, findTransfer, updateTransfer, deleteTransfer } from '../services/transfer.service';

export const createTransferHandler = async (req: Request<{}, {}, TransferBody>, res: Response, next: NextFunction) => {
  try {
    const transfer = await createTransfer(res.locals.user.id, req.body);
    res.status(201).json({ status: 'success', data: { transfer } });
  } catch (err) {
    next(err);
  }
};

export const getTransferHandler = async (req: Request<TransferParams>, res: Response, next: NextFunction) => {
  try {
    const transfer = await findTransfer(res.locals.user.id, req.params.transferId);
    res.status(200).json({ status: 'success', data: { transfer } });
  } catch (err) {
    next(err);
  }
};

export const updateTransferHandler = async (req: Request<TransferParams, {}, TransferBody>, res: Response, next: NextFunction) => {
  try {
    const transfer = await updateTransfer(res.locals.user.id, req.params.transferId, req.body);
    res.status(200).json({ status: 'success', data: { transfer } });
  } catch (err) {
    next(err);
  }
};

export const deleteTransferHandler = async (req: Request<TransferParams>, res: Response, next: NextFunction) => {
  try {
    await deleteTransfer(res.locals.user.id, req.params.transferId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
