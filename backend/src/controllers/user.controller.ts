import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { omit } from 'lodash';
import { Prisma } from '@prisma/client';
import { PutAvatarInput } from '../schemas/avatar.schema';
import { ChangePasswordInput, UpdateMeInput } from '../schemas/user.schema';
import { deleteAllSessions, excludedFields, findAvatar, findUniqueUser, getApiTokenStatus, removeAvatar, saveAvatar, issueApiToken, revokeApiToken, updateUser } from '../services/user.service';
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

export const putAvatarHandler = async (req: Request<{}, {}, PutAvatarInput>, res: Response, next: NextFunction) => {
  try {
    const user = await saveAvatar(res.locals.user.id, Buffer.from(req.body.image, 'base64'), req.body.mimeType);
    res.status(200).json({ status: 'success', data: { user: omit(user, excludedFields) } });
  } catch (err) {
    next(err);
  }
};

export const getAvatarHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const avatar = await findAvatar(res.locals.user.id);
    if (!avatar) return next(new AppError(404, 'No profile photo'));
    // The URL carries ?v=<avatarUpdatedAt>, so a new photo gets a new URL
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.type(avatar.mimeType).send(Buffer.from(avatar.image));
  } catch (err) {
    next(err);
  }
};

export const deleteAvatarHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await removeAvatar(res.locals.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
