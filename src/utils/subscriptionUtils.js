/**
 * subscriptionUtils.js
 * Complete utilities for subscription management
 */

import { Op } from 'sequelize';
import { differenceInDays, addMonths, endOfMonth, isAfter, isSameMonth, startOfMonth } from 'date-fns';
import Invoice from '../models/postgres/Invoice.model.js';

/**
 * 
 * Calculate prorated amount based on days
 */
export const calculateProratedAmount = (monthlyPrice, startDate, endDate) => {
  const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
  const daysToCharge = differenceInDays(endDate, startDate) + 1;
  const dailyRate = monthlyPrice / daysInMonth;
  
  return Math.round(dailyRate * daysToCharge * 100) / 100;
};

/**
 * Generate unique invoice number
 */
export const generateInvoiceNumber = async (instituteCode) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  
  return `INV-${instituteCode}-${year}${month}-${randomSeq}`;
};

/**
 * Calculate due date based on generation date
 * Set to 4 days after generation date
 */
export const calculateDueDate = (generationDate = new Date()) => {
  const dueDate = new Date(generationDate);
  dueDate.setDate(dueDate.getDate() + 4); 
  return dueDate;
};

/**
 * Get next billing date based on cycle
 */
export const getNextBillingDate = (currentPeriodEnd, cycle) => {
  const date = new Date(currentPeriodEnd);
  
  switch (cycle) {
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'HALF_YEARLY':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  
  return startOfMonth(date);
};

/**
 * Check if institute needs a new invoice
 */
export const needsNewInvoice = async (instituteId) => {
  const today = new Date();
  const firstOfMonth = startOfMonth(today);
  
  // Check if invoice already exists for current month
  const existingInvoice = await Invoice.findOne({
    where: {
      institute_id: instituteId,
      period_start: firstOfMonth
    }
  });
  
  if (existingInvoice) {
    return false; // Already have invoice for this month
  }
  
  return true; // No invoice for this month, generate one
};

/**
 * Get invoice status summary for institute
 */
export const getInvoiceSummary = async (instituteId) => {
  const invoices = await Invoice.findAll({
    where: { institute_id: instituteId },
    order: [['period_start', 'DESC']]
  });
  
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(i => i.status === 'PAID').length;
  const pendingInvoices = invoices.filter(i => i.status === 'PENDING').length;
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE').length;
  
  const totalPaidAmount = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + parseFloat(i.total_amount), 0);
  
  const totalDueAmount = invoices
    .filter(i => i.status === 'PENDING' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + parseFloat(i.total_amount), 0);
  
  return {
    totalInvoices,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    totalPaidAmount,
    totalDueAmount,
    lastInvoiceDate: invoices[0]?.period_end || null
  };
};