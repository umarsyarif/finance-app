import { NextFunction, Request, Response } from 'express';
import { GetStatsInput } from '../schemas/stats.schema';
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getTrendData,
  StatsFilters,
} from '../services/stats.service';
import AppError from '../utils/appError';

// Date-only strings ("2026-10-01") would parse as UTC midnight; treat them as whole local days instead
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseRangeDate(value: string, endOfDay: boolean): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) return new Date(value);
  const [, y, m, d] = match.map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

export const getMonthlySummaryHandler = async (
  req: Request<{}, {}, {}, GetStatsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, walletIds, categoryId, year, month } = req.query;
    const userId = res.locals.user.id;

    const filters: StatsFilters = {
      userId,
      startDate: startDate ? parseRangeDate(startDate, false) : undefined,
      endDate: endDate ? parseRangeDate(endDate, true) : undefined,
      walletIds: walletIds ? walletIds.split(',').map(id => id.trim()) : undefined,
      categoryId,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    };

    const summary = await getMonthlySummary(filters);

    if (!summary) {
      return res.status(200).json({
      status: 'success',
      data: {
        month: filters.month || new Date().getMonth() + 1,
        year: filters.year || new Date().getFullYear(),
        income: 0,
        expense: 0,
        balance: 0,
      },
    });
    }

    res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getCategoryBreakdownHandler = async (
  req: Request<{}, {}, {}, GetStatsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, walletIds, year, month } = req.query;
    const userId = res.locals.user.id;

    const filters: StatsFilters = {
      userId,
      startDate: startDate ? parseRangeDate(startDate, false) : undefined,
      endDate: endDate ? parseRangeDate(endDate, true) : undefined,
      walletIds: walletIds ? walletIds.split(',').map(id => id.trim()) : undefined,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    };

    const breakdown = await getCategoryBreakdown(filters);

    res.status(200).json({
      status: 'success',
      data: breakdown,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getTrendDataHandler = async (
  req: Request<{}, {}, {}, GetStatsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletIds, categoryId, year } = req.query;
    const userId = res.locals.user.id;

    const filters: StatsFilters = {
      userId,
      walletIds: walletIds ? walletIds.split(',').map(id => id.trim()) : undefined,
      categoryId,
      year: year ? parseInt(year) : undefined,
    };

    const trendData = await getTrendData(filters);

    res.status(200).json({
      status: 'success',
      data: trendData,
    });
  } catch (err: any) {
    next(err);
  }
};