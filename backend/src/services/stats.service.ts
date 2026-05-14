import { Prisma } from '@prisma/client';
import prisma from '../middleware/prismaMiddleware';

export interface MonthlySummary {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  amount: number;
  percentage: number;
}

export interface TrendData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface StatsFilters {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  walletIds?: string[];
  categoryId?: string;
  year?: number;
  month?: number;
}

export const getMonthlySummary = async (filters: StatsFilters): Promise<MonthlySummary | null> => {
  const { userId, year, month, walletIds, categoryId, startDate, endDate } = filters;

  // Build where clause
  const whereClause: Prisma.TransactionWhereInput = {
    wallet: {
      userId,
    },
  };

  // Add date filters
  if (year && month) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    whereClause.date = {
      gte: startOfMonth,
      lte: endOfMonth,
    };
  } else if (startDate && endDate) {
    whereClause.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Add wallet filter
  if (walletIds && walletIds.length > 0) {
    whereClause.walletId = {
      in: walletIds,
    };
  }

  // Add category filter
  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  // Get transactions with category type
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      category: true,
    },
  });

  if (transactions.length === 0) {
    return null;
  }

  // Calculate totals
  let income = 0;
  let expense = 0;

  transactions.forEach((transaction) => {
    if (transaction.category.type === 'INCOME') {
      income += transaction.amount;
    } else {
      expense += transaction.amount;
    }
  });

  const balance = income - expense;
  const currentMonth = month || new Date().getMonth() + 1;
  const currentYear = year || new Date().getFullYear();

  return {
    month: currentMonth,
    year: currentYear,
    income,
    expense,
    balance,
  };
};

export const getCategoryBreakdown = async (filters: StatsFilters): Promise<CategoryBreakdown[]> => {
  const { userId, startDate, endDate, walletIds, year, month } = filters;

  // Build where clause
  const whereClause: Prisma.TransactionWhereInput = {
    wallet: {
      userId,
    },
    category: {
      type: 'EXPENSE', // Only show expense categories in breakdown
    },
  };

  // Add date filters
  if (year && month) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    whereClause.date = {
      gte: startOfMonth,
      lte: endOfMonth,
    };
  } else if (startDate && endDate) {
    whereClause.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Add wallet filter
  if (walletIds && walletIds.length > 0) {
    whereClause.walletId = {
      in: walletIds,
    };
  }

  // Get aggregated data by category
  const categoryTotals = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: whereClause,
    _sum: {
      amount: true,
    },
  });

  if (categoryTotals.length === 0) {
    return [];
  }

  // Calculate total expense for percentage calculation
  const totalExpense = categoryTotals.reduce((sum, item) => sum + (item._sum.amount || 0), 0);

  // Get category details and build result
  const categoryIds = categoryTotals.map((c) => c.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const result: CategoryBreakdown[] = [];
  for (const categoryTotal of categoryTotals) {
    const category = categoryMap.get(categoryTotal.categoryId);
    if (category && categoryTotal._sum.amount) {
      const amount = categoryTotal._sum.amount;
      const percentage = (amount / totalExpense) * 100;
      result.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        amount,
        percentage,
      });
    }
  }
  return result.sort((a, b) => b.amount - a.amount);
};

export const getTrendData = async (filters: StatsFilters): Promise<TrendData[]> => {
  const { userId, walletIds, categoryId, year } = filters;
  const currentYear = year || new Date().getFullYear();

  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const whereClause: Prisma.TransactionWhereInput = {
    wallet: { userId },
    date: { gte: startOfYear, lte: endOfYear },
  };
  if (walletIds && walletIds.length > 0) whereClause.walletId = { in: walletIds };
  if (categoryId) whereClause.categoryId = categoryId;

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    select: { amount: true, date: true, category: { select: { type: true } } },
  });

  const monthlyData: Record<number, { income: number; expense: number }> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyData[m] = { income: 0, expense: 0 };
  }

  for (const t of transactions) {
    const m = new Date(t.date).getMonth() + 1;
    if (t.category.type === 'INCOME') {
      monthlyData[m].income += t.amount;
    } else {
      monthlyData[m].expense += t.amount;
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const { income, expense } = monthlyData[m];
    const monthName = new Date(currentYear, i).toLocaleString('default', { month: 'short' });
    return { month: monthName, income, expense, balance: income - expense };
  });
};