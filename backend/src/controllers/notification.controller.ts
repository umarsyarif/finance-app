import { Request, Response, NextFunction } from 'express';
import config from 'config';
import prisma from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';
import { getSettings, isPushConfigured, SETTINGS_DEFAULTS } from '../services/notifications/notification.service';
import { isValidTimeZone } from '../services/notifications/schedule';

const uid = (res: Response): string => res.locals.user.id;
const PAGE = 30;
const unread = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });
const pick = (b: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

export const listNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const cursor = req.query.cursor as string | undefined;
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: { id: true, kind: true, title: true, body: true, url: true, readAt: true, createdAt: true },
    });
    const notifications = rows.slice(0, PAGE);
    res.status(200).json({
      status: 'success',
      data: { notifications, nextCursor: rows.length > PAGE ? notifications[PAGE - 1].id : null, unreadCount: await unread(userId) },
    });
  } catch (err) { next(err); }
};

export const readNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const where = req.body.all === true ? { userId, readAt: null } : { userId, readAt: null, id: { in: req.body.ids as string[] } };
    await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    res.status(200).json({ status: 'success', data: { unreadCount: await unread(userId) } });
  } catch (err) { next(err); }
};

export const getSettingsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.status(200).json({ status: 'success', data: { settings: await getSettings(uid(res)) } }); } catch (err) { next(err); }
};

export const putSettingsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, ['nudgeEnabled', 'nudgeTime', 'timezone', 'shortcutEnabled', 'monthlySummaryEnabled']);
    if (data.timezone !== undefined && !isValidTimeZone(data.timezone as string)) throw new AppError(400, 'Unknown timezone');
    const userId = uid(res);
    await prisma.notificationSettings.upsert({ where: { userId }, create: { ...SETTINGS_DEFAULTS, ...data, userId }, update: data });
    res.status(200).json({ status: 'success', data: { settings: await getSettings(userId) } });
  } catch (err) { next(err); }
};

export const pushKeyHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isPushConfigured()) throw new AppError(503, "Push isn't set up");
    res.status(200).json({ status: 'success', data: { publicKey: config.get<string>('vapidPublicKey') } });
  } catch (err) { next(err); }
};

export const subscribeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
    const data = { userId, p256dh: keys.p256dh, auth: keys.auth };
    await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
    res.status(201).json({ status: 'success' });
  } catch (err) { next(err); }
};

export const unsubscribeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint as string, userId: uid(res) } });
    res.status(204).end();
  } catch (err) { next(err); }
};
