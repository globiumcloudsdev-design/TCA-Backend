// src/utils/expenseNumberGenerator.js
/**
 * Generate sequential expense number
 * Format: EXP-yyyy-00001, EXP-yyyy-00002, etc.
 * @param {Date} date - expense date
 * @param {number} sequence - sequence number for the year
 * @returns {string} - formatted expense number
 */
export const generateExpenseNumber = (date = new Date(), sequence = 1) => {
  const year = date.getFullYear();
  const paddedSequence = String(sequence).padStart(5, '0');
  return `EXP-${year}-${paddedSequence}`;
};

/**
 * Generate receipt URL using expense ID
 * Format: /downloads/receipts/exp-{id}.pdf
 * @param {string} expenseId - expense UUID
 * @returns {string} - receipt URL path
 */
export const generateReceiptUrl = (expenseId) => {
  if (!expenseId) return null;
  return `/downloads/receipts/exp-${expenseId}.pdf`;
};