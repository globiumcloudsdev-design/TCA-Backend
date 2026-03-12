/**
 * The Clouds Academy - Email Service
 */

import { sendEmail } from '../config/email.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

export const sendWelcomeEmail = async (to, name) => {
  try {
    await sendEmail({
      to,
      subject: 'Welcome to The Clouds Academy',
      template: 'welcome',
      context: { name, loginUrl: `${config.frontendUrl}/login` },
    });
  } catch (err) {
    logger.error('Welcome email failed:', err);
  }
};

export const sendPasswordResetEmail = async (to, token, name) => {
  const resetUrl = `${config.frontendUrl}/reset-password/${token}`;
  await sendEmail({
    to,
    subject: 'Password Reset Request - The Clouds Academy',
    template: 'forgot-password',
    context: { name, resetUrl, expiresIn: '30 minutes' },
  });
};

export const sendFeeReminderEmail = async (to, { studentName, voucherNumber, amount, dueDate }) => {
  await sendEmail({
    to,
    subject: `Fee Reminder - ${studentName}`,
    template: 'fee-reminder',
    context: { studentName, voucherNumber, amount, dueDate },
  });
};

export const sendInvoiceEmail = async (to, invoice) => {
  await sendEmail({
    to,
    subject: `Invoice #${invoice.invoice_number} - The Clouds Academy`,
    template: 'invoice',
    context: { invoice },
  });
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendFeeReminderEmail,
  sendInvoiceEmail,
};
