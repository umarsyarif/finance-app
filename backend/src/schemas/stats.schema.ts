import { object, string, number, date, TypeOf } from 'zod';

export const getStatsSchema = object({
  query: object({
    startDate: string().optional().refine((val) => {
      if (val) {
        const date = new Date(val);
        return !isNaN(date.getTime());
      }
      return true;
    }, 'Invalid start date format'),
    endDate: string().optional().refine((val) => {
      if (val) {
        const date = new Date(val);
        return !isNaN(date.getTime());
      }
      return true;
    }, 'Invalid end date format'),
    walletId: string().optional(),
    categoryId: string().optional(),
    year: string().optional().refine((val) => {
      if (val) {
        const year = parseInt(val);
        return !isNaN(year) && year >= 2000 && year <= 2100;
      }
      return true;
    }, 'Invalid year'),
    month: string().optional().refine((val) => {
      if (val) {
        const month = parseInt(val);
        return !isNaN(month) && month >= 1 && month <= 12;
      }
      return true;
    }, 'Invalid month (must be 1-12)'),
  }),
});

export type GetStatsInput = TypeOf<typeof getStatsSchema>['query'];