import { NextFunction, Request, Response } from 'express';
import { GetStatsInput } from '../schemas/stats.schema';
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getTrendData,
  StatsFilters,
} from '../services/stats.service';
import AppError from '../utils/appError';

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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
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