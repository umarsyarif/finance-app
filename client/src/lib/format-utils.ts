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

/**
 * Formats an amount with currency and sign based on transaction type
 * @param amount - The transaction amount
 * @param type - Transaction type ('INCOME' or 'EXPENSE')
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted amount string with appropriate sign
 */
export const formatAmount = (amount: number, type: string|null = null, currency: string = 'USD'): string => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(Math.abs(amount));
  
  return type === null ? `${formattedAmount}` : (type === 'INCOME' ? `+${formattedAmount}` : `-${formattedAmount}`);
};

/**
 * Formats an amount as currency without sign
 * @param amount - The amount to format
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};