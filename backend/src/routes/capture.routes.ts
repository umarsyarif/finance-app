import express from 'express';
import rateLimit from 'express-rate-limit';
import { capturePhotoHandler, captureTextHandler } from '../controllers/capture.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireApiToken } from '../middleware/requireApiToken';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { capturePhotoSchema, captureTextSchema } from '../schemas/capture.schema';

const router = express.Router();

// Failed token attempts are throttled per IP (only 401 responses count), before any token lookup
const failedTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many failed attempts, try again later.' },
});

// One budget per user across both endpoints, to protect the Gemini free quota
const captureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (_req, res) => res.locals.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many captures, try again in an hour.' },
});

router.post('/text', failedTokenLimiter, requireApiToken, captureLimiter, validate(captureTextSchema), captureTextHandler);
router.post('/photo', deserializeUser, requireUser, captureLimiter, validate(capturePhotoSchema), capturePhotoHandler);

export default router;
