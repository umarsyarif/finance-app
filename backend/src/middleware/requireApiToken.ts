import { NextFunction, Request, Response } from 'express';
import { findUserByApiToken } from '../services/user.service';
import AppError from '../utils/appError';

// Authenticates `Authorization: Bearer ft_…` personal API tokens (iOS Shortcut only)
export const requireApiToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const user = token ? await findUserByApiToken(token) : null;
    if (!user) {
      return next(new AppError(401, 'Invalid or missing API token'));
    }
    res.locals.user = user;
    next();
  } catch (err: any) {
    next(err);
  }
};
