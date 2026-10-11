import express from 'express';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import {
  getPortfolioSchema, listLotsSchema, createLotSchema, updateLotSchema, lotParamsSchema, putCostSchema, putBinanceSchema,
} from '../schemas/asset.schema';
import {
  getPortfolioHandler, listLotsHandler, createLotHandler, updateLotHandler, deleteLotHandler,
  putCostHandler, putBinanceHandler, deleteBinanceHandler,
} from '../controllers/asset.controller';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.get('/', validate(getPortfolioSchema), getPortfolioHandler);
router.get('/lots', validate(listLotsSchema), listLotsHandler);
router.post('/lots', validate(createLotSchema), createLotHandler);
router.patch('/lots/:id', validate(updateLotSchema), updateLotHandler);
router.delete('/lots/:id', validate(lotParamsSchema), deleteLotHandler);
router.put('/costs/:assetClass/:symbol', validate(putCostSchema), putCostHandler);
router.put('/sources/binance', validate(putBinanceSchema), putBinanceHandler);
router.delete('/sources/binance', deleteBinanceHandler);

export default router;
