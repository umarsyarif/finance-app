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
  walletId?: string;
  categoryId?: string;
  year?: number;
  month?: number;
}

export const getMonthlySummary = async (filters: StatsFilters): Promise<MonthlySummary | null> => {
  const { userId, year, month, walletId, categoryId, startDate, endDate } = filters;

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
  if (walletId) {
    whereClause.walletId = walletId;
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
  const { userId, startDate, endDate, walletId, year, month } = filters;

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
  if (walletId) {
    whereClause.walletId = walletId;
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
  const result: CategoryBreakdown[] = [];

  for (const categoryTotal of categoryTotals) {
    const category = await prisma.category.findUnique({
      where: { id: categoryTotal.categoryId },
    });

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

  // Sort by amount descending
  return result.sort((a, b) => b.amount - a.amount);
};

export const getTrendData = async (filters: StatsFilters): Promise<TrendData[]> => {
  const { userId, walletId, categoryId, year } = filters;
  const currentYear = year || new Date().getFullYear();

  const result: TrendData[] = [];

  // Get data for each month of the year
  for (let month = 1; month <= 12; month++) {
    const startOfMonth = new Date(currentYear, month - 1, 1);
    const endOfMonth = new Date(currentYear, month, 0, 23, 59, 59, 999);

    const whereClause: Prisma.TransactionWhereInput = {
      wallet: {
        userId,
      },
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    };

    // Add wallet filter
    if (walletId) {
      whereClause.walletId = walletId;
    }

    // Add category filter
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    // Get transactions for this month
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: true,
      },
    });

    // Calculate totals for this month
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
    const monthName = new Date(currentYear, month - 1).toLocaleString('default', { month: 'short' });

    result.push({
      month: monthName,
      income,
      expense,
      balance,
    });
  }

  return result;
};