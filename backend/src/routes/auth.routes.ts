import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  loginUserHandler,
  logoutUserHandler,
  refreshAccessTokenHandler,
  registerUserHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import {
  loginUserSchema,
  registerUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/user.schema';

const authRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again in an hour.' },
});

authRouter.post('/register', authLimiter, validate(registerUserSchema), registerUserHandler);
authRouter.post('/login', authLimiter, validate(loginUserSchema), loginUserHandler);
authRouter.get('/refresh', refreshAccessTokenHandler);
authRouter.get('/logout', deserializeUser, requireUser, logoutUserHandler);
authRouter.get('/verifyemail/:verificationCode', authLimiter, verifyEmailHandler);
authRouter.post('/forgotpassword', strictLimiter, validate(forgotPasswordSchema), forgotPasswordHandler);
authRouter.patch('/resetpassword/:resetToken', strictLimiter, validate(resetPasswordSchema), resetPasswordHandler);

export default authRouter;
