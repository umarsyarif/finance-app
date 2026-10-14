import express from 'express';
import { object } from 'zod';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { subscribeSchema, unsubscribeSchema } from '../schemas/notification.schema';
import { pushKeyHandler, subscribeHandler, unsubscribeHandler } from '../controllers/notification.controller';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.get('/key', validate(object({})), pushKeyHandler);
router.post('/subscribe', validate(subscribeSchema), subscribeHandler);
router.delete('/subscribe', validate(unsubscribeSchema), unsubscribeHandler);

export default router;
