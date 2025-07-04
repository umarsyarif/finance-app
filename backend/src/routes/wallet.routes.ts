import express from 'express';
import {
  createWalletHandler,
  deleteWalletHandler,
  getWalletsHandler,
  getWalletHandler,
  updateWalletHandler,
  getUserWalletsHandler,
  getMainWalletHandler,
  setMainWalletHandler,
  updateWalletOrderHandler,
} from '../controllers/wallet.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import {
  createWalletSchema,
  deleteWalletSchema,
  getWalletsSchema,
  getWalletSchema,
  updateWalletSchema,
} from '../schemas/wallet.schema';

const router = express.Router();

router.use(deserializeUser, requireUser);

// GET /api/wallets
router.get('/', validate(getWalletsSchema), getWalletsHandler);

// POST /api/wallets
router.post('/', validate(createWalletSchema), createWalletHandler);

// GET /api/wallets/user - Get current user's wallets
router.get('/user', getUserWalletsHandler);

// GET /api/wallets/main - Get current user's main wallet
router.get('/main', getMainWalletHandler);

// PUT /api/wallets/order - Update wallet display order
router.put('/order', updateWalletOrderHandler);

// GET /api/wallets/:walletId
router.get('/:walletId', validate(getWalletSchema), getWalletHandler);

// PATCH /api/wallets/:walletId
router.patch('/:walletId', validate(updateWalletSchema), updateWalletHandler);

// PUT /api/wallets/:walletId/main - Set wallet as main
router.put('/:walletId/main', setMainWalletHandler);

// DELETE /api/wallets/:walletId
router.delete('/:walletId', validate(deleteWalletSchema), deleteWalletHandler);

export default router;