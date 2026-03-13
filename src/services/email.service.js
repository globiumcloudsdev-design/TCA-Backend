/**
 * The Clouds Academy - Email Service
 */

import { sendEmail } from '../config/email.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { generateQRCodeBuffer } from '../utils/qrCodeGenerator.js';

/**
 * Send welcome email with credentials
 */
/**
 * Send welcome email with credentials and QR code
 */
export const sendWelcomeEmailWithCredentials = async (user, password, instituteName, qrCodeUrl) => {
  try {
    const loginUrl = `${config.frontendUrl}/login`;
    const name = `${user.first_name} ${user.last_name}`;
    
    // Generate QR code for attachment
    const qrBuffer = await generateQRCodeBuffer(user);
    
    // Get full URL for QR code
    const fullQrUrl = qrCodeUrl ? `${config.baseUrl}${qrCodeUrl}` : null;
    
    await sendEmail({
      to: user.email,
      subject: `Welcome to ${instituteName} - Your Account Credentials`,
      template: 'welcome-credentials',
      context: {
        name,
        email: user.email,
        password,
        loginUrl,
        userType: user.user_type,
        registrationNo: user.registration_no,
        instituteName,
        qrCodeUrl: fullQrUrl,
        year: new Date().getFullYear()
      },
      attachments: [
        {
          filename: `qr_code_${user.id}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid: 'qrcode' // Content ID for embedding in email
        }
      ]
    });
    
    logger.info(`✅ Welcome email sent to ${user.email}`);
  } catch (error) {
    logger.error('❌ Welcome email failed:', error);
    throw error;
  }
};

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
  sendWelcomeEmailWithCredentials
};
