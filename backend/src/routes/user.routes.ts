import express from 'express';
import { changePasswordHandler, createApiTokenHandler, deleteApiTokenHandler, getApiTokenHandler, getMeHandler, updateMeHandler } from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import { changePasswordSchema, updateMeSchema } from '../schemas/user.schema';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';

const router = express.Router();

router.use(deserializeUser, requireUser);

router.get('/me', getMeHandler);
router.patch('/me', validate(updateMeSchema), updateMeHandler);
router.post('/me/password', validate(changePasswordSchema), changePasswordHandler);
router.get('/me/api-token', getApiTokenHandler);
router.post('/me/api-token', createApiTokenHandler);
router.delete('/me/api-token', deleteApiTokenHandler);

export default router;
