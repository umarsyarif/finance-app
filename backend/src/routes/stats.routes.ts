import express from 'express';
import {
  getMonthlySummaryHandler,
  getCategoryBreakdownHandler,
  getTrendDataHandler,
} from '../controllers/stats.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { getStatsSchema } from '../schemas/stats.schema';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(deserializeUser, requireUser);

// GET /api/stats/monthly-summary
router.get(
  '/monthly-summary',
  validate(getStatsSchema),
  getMonthlySummaryHandler
);

// GET /api/stats/category-breakdown
router.get(
  '/category-breakdown',
  validate(getStatsSchema),
  getCategoryBreakdownHandler
);

// GET /api/stats/trend
router.get(
  '/trend',
  validate(getStatsSchema),
  getTrendDataHandler
);

export default router;