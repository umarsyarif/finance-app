import express from 'express';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { listNotificationsSchema, readNotificationsSchema, putSettingsSchema } from '../schemas/notification.schema';
import {
  listNotificationsHandler, readNotificationsHandler, getSettingsHandler, putSettingsHandler,
} from '../controllers/notification.controller';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.get('/', validate(listNotificationsSchema), listNotificationsHandler);
router.post('/read', validate(readNotificationsSchema), readNotificationsHandler);
router.get('/settings', getSettingsHandler);
router.put('/settings', validate(putSettingsSchema), putSettingsHandler);

export default router;
