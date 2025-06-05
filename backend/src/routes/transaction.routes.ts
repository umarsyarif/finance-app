import express from 'express';
import {
  createTransactionHandler,
  getTransactionHandler,
  getTransactionsHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
} from '../controllers/transaction.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionSchema,
  deleteTransactionSchema,
  getTransactionsSchema,
} from '../schemas/transaction.schema';

const router = express.Router();

router.use(deserializeUser, requireUser);

// Create transaction
router.post('/', validate(createTransactionSchema), createTransactionHandler);

// Get all transactions with optional filtering
router.get('/', validate(getTransactionsSchema), getTransactionsHandler);

// Get single transaction
router.get('/:transactionId', validate(getTransactionSchema), getTransactionHandler);

// Update transaction
router.patch('/:transactionId', validate(updateTransactionSchema), updateTransactionHandler);

// Delete transaction
router.delete('/:transactionId', validate(deleteTransactionSchema), deleteTransactionHandler);

export default router;