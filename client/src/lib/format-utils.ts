/**
 * Utility functions for formatting dates and amounts in the finance app
 */

/**
 * Formats a date string to display format: "2 Jan 2024 15:04"
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Formats a date string to display format: "January 2024"
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export const formatMonthAndYear = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Formats a date string for detailed view: "January 2, 2024"
 * @param dateString - ISO date string
 * @returns Formatted date string for detailed view
 */
export const formatDateDetailed = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

// "₩48,500", "Rp 18,450,000": narrow symbols, whole numbers only.
// KRW and IDR have no subunit in practice; stored amounts keep their decimals, only the display rounds.
const money = (currency: string) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats an amount with currency, signed by transaction type
 * @param amount - The amount
 * @param type - 'INCOME' (+), 'EXPENSE' (-), or null to keep the amount's own sign (e.g. a balance)
 * @param currency - Currency code (default: 'KRW')
 */
export const formatAmount = (amount: number, type: string | null = null, currency: string = 'KRW'): string => {
  if (type === null) return money(currency).format(amount);
  const formatted = money(currency).format(Math.abs(amount));
  return type === 'INCOME' ? `+${formatted}` : `-${formatted}`;
};

/**
 * Formats an amount as currency without a forced sign
 */
export const formatCurrency = (amount: number, currency: string = 'KRW'): string => money(currency).format(amount);
