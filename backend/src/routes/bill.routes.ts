import express from 'express';
import { object } from 'zod';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { createBillSchema, updateBillSchema, billParamsSchema } from '../schemas/bill.schema';
import { listBillsHandler, createBillHandler, updateBillHandler, deleteBillHandler } from '../controllers/bill.controller';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.get('/', validate(object({})), listBillsHandler);
router.post('/', validate(createBillSchema), createBillHandler);
router.patch('/:id', validate(updateBillSchema), updateBillHandler);
router.delete('/:id', validate(billParamsSchema), deleteBillHandler);

export default router;
