import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { omit } from 'lodash';
import { Prisma } from '@prisma/client';
import { ChangePasswordInput, UpdateMeInput } from '../schemas/user.schema';
import { deleteAllSessions, excludedFields, findUniqueUser, getApiTokenStatus, issueApiToken, revokeApiToken, updateUser } from '../services/user.service';
import AppError from '../utils/appError';

export const getMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = res.locals.user;

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const updateMeHandler = async (
  req: Request<{}, {}, UpdateMeInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email } = req.body;
    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase();

    const user = await updateUser({ id: res.locals.user.id }, data);

    res.status(200).json({
      status: 'success',
      data: { user: omit(user, excludedFields) },
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(new AppError(409, 'Email already exist, please use another email address'));
    }
    next(err);
  }
};

export const changePasswordHandler = async (
  req: Request<{}, {}, ChangePasswordInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = res.locals.user.id;

    const user = await findUniqueUser({ id: userId }, { password: true });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return next(new AppError(400, 'Current password is incorrect'));
    }

    await updateUser({ id: userId }, { password: await bcrypt.hash(newPassword, 12) });
    // Sign out every other device; this one stays signed in
    await deleteAllSessions(userId, res.locals.sessionId);
    // A password change also invalidates the Shortcut token
    await revokeApiToken(userId);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (err: any) {
    next(err);
  }
};

export const getApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ status: 'success', data: await getApiTokenStatus(res.locals.user.id) });
  } catch (err: any) {
    next(err);
  }
};

export const createApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await issueApiToken(res.locals.user.id);
    res.status(201).json({ status: 'success', data: { token } });
  } catch (err: any) {
    next(err);
  }
};

export const deleteApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeApiToken(res.locals.user.id);
    res.status(204).end();
  } catch (err: any) {
    next(err);
  }
};
