/**
 * Date utility functions for the finance app
 * Centralized location for all date-related operations
 */

/**
 * Gets the current date
 * @returns Current Date object
 */
export const getCurrentDate = (): Date => {
  return new Date();
};

/**
 * Gets the current month (1-12)
 * @returns Current month number
 */
export const getCurrentMonth = (): number => {
  return new Date().getMonth() + 1;
};

/**
 * Gets the current year
 * @returns Current year number
 */
export const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

/**
 * Gets the start of the current month
 * @returns Date object representing the first day of current month
 */
export const getStartOfCurrentMonth = (): Date => {
  const currentDate = new Date();
  return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
};

/**
 * Gets the end of the current month
 * @returns Date object representing the last day of current month
 */
export const getEndOfCurrentMonth = (): Date => {
  const currentDate = new Date();
  return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
};

/**
 * Gets the start of a specific month
 * @param year - The year
 * @param month - The month (1-12)
 * @returns Date object representing the first day of the specified month
 */
export const getStartOfMonth = (year: number, month: number): Date => {
  return new Date(year, month - 1, 1);
};

/**
 * Gets the end of a specific month
 * @param year - The year
 * @param month - The month (1-12)
 * @returns Date object representing the last day of the specified month
 */
export const getEndOfMonth = (year: number, month: number): Date => {
  return new Date(year, month, 0, 23, 59, 59, 999);
};

/**
 * Formats a date for HTML input fields (YYYY-MM-DDTHH:MM)
 * @param date - Date object or date string
 * @returns Formatted date string for input fields
 */
export const formatDateForInput = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().slice(0, 16);
  }
  return new Date().toISOString().slice(0, 16);
};

/**
 * Formats a date for HTML date input fields (YYYY-MM-DD)
 * Avoids timezone issues by using local date methods
 * @param date - Date object
 * @returns Formatted date string (YYYY-MM-DD)
 */
export const formatDateForDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Checks if a date is within a specified range
 * @param date - Date to check
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns True if date is within range
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Gets a date range label for display
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range label
 */
export const getDateRangeLabel = (startDate: string, endDate: string): string => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same month and year, show "Month Year"
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleString('default', { month: 'long' })} ${start.getFullYear()}`;
    }
    
    // Otherwise show date range
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  } catch (error) {
    // Fallback to current month
    const now = new Date();
    return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  }
};

/**
 * Navigates to previous month
 * @param currentDate - Current date
 * @returns Date object for previous month
 */
export const getPreviousMonth = (currentDate: Date): Date => {
  const newDate = new Date(currentDate);
  newDate.setMonth(newDate.getMonth() - 1);
  return newDate;
};

/**
 * Navigates to next month
 * @param currentDate - Current date
 * @returns Date object for next month
 */
export const getNextMonth = (currentDate: Date): Date => {
  const newDate = new Date(currentDate);
  newDate.setMonth(newDate.getMonth() + 1);
  return newDate;
};

/**
 * Converts form date input to ISO string
 * @param formDateString - Date string from form input
 * @returns ISO string representation
 */
export const convertFormDateToISO = (formDateString: string): string => {
  return new Date(formDateString).toISOString();
};

/**
 * Parses a date string into a Date object
 * @param dateString - Date string to parse
 * @returns Date object
 */
export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

/**
 * Formats a date to locale string
 * @param date - Date object to format
 * @param locale - Locale string (e.g., 'en-US')
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDateToLocaleString = (date: Date, locale: string, options: Intl.DateTimeFormatOptions): string => {
  return date.toLocaleDateString(locale, options);
};

/**
 * Converts a date to ISO string
 * @param date - Date object to convert
 * @returns ISO string representation
 */
export const dateToISOString = (date: Date): string => {
  return date.toISOString();
};

/**
 * Validates if a string is a valid date
 * @param dateString - Date string to validate
 * @returns True if valid date
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};