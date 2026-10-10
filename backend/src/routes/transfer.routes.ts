import express from 'express';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { createTransferSchema, updateTransferSchema, transferParamsSchema } from '../schemas/transfer.schema';
import {
  createTransferHandler,
  getTransferHandler,
  updateTransferHandler,
  deleteTransferHandler,
} from '../controllers/transfer.controller';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.post('/', validate(createTransferSchema), createTransferHandler);
router.get('/:transferId', validate(transferParamsSchema), getTransferHandler);
router.patch('/:transferId', validate(updateTransferSchema), updateTransferHandler);
router.delete('/:transferId', validate(transferParamsSchema), deleteTransferHandler);

export default router;
