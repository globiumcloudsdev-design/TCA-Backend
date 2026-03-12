/**
 * The Clouds Academy - Date Helper
 */

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

export const isExpired = (date) => new Date(date) < new Date();

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

export const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
};

export default { formatDate, isExpired, addDays, addMonths, getMonthRange };
