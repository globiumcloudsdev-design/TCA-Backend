
/**
 * The Clouds Academy - Email Service
 */

import { sendEmail } from '../config/email.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { generateQRCodeBuffer } from '../utils/qrCodeGenerator.js';

const USER_TYPE_LABELS = {
  PARENT: 'Parent',
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  STAFF: 'Staff Member',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
  ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian'
};

const normalizeUserTypeLabel = (rawType) => {
  if (!rawType) return 'Staff Member';

  const type = String(rawType).trim();
  const upper = type.toUpperCase().replace(/\s+/g, '_');

  if (USER_TYPE_LABELS[upper]) {
    return USER_TYPE_LABELS[upper];
  }

  // Fallback for custom role names: "vice_principal" -> "Vice Principal"
  return type
    .replace(/[_\-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Send welcome email with credentials and QR code
 */
export const sendWelcomeEmailWithCredentials = async (user, password, instituteName, qrCodeUrl, userType = 'Staff Member') => {
  try {
    if (!user.email) {
      logger.warn(`⚠️ No email provided for user ${user.id}, skipping welcome email`);
      return false;
    }

    const loginUrl = `${config.frontendUrl}/login`;
    const name = `${user.first_name} ${user.last_name}`;
    
    // Generate QR code for attachment
    const qrBuffer = await generateQRCodeBuffer(user);
    
    const resolvedUserType = normalizeUserTypeLabel(user?.user_type || userType);

    // Get registration number
    const registrationNo = user.registration_no || user.details?.employee_id || 'N/A';
    
    const emailOptions = {
      to: user.email,
      subject: `Welcome to ${instituteName} - Your ${resolvedUserType} Account Credentials`,
      template: 'welcome-credentials',
      context: {
        name,
        email: user.email,
        password,
        loginUrl,
        userType: resolvedUserType,
        registrationNo,
        instituteName,
        qrCodeUrl: qrCodeUrl || null,
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
    };
    
    await sendEmail(emailOptions);
    
    logger.info(`✅ Welcome email sent to ${user.email}`);
    return true;
  } catch (error) {
    logger.error('❌ Welcome email failed:', error);
    // Don't throw error - we don't want to fail user creation if email fails
    return false;
  }
};

/**
 * Send welcome email (simple version)
 */
export const sendWelcomeEmail = async (to, name) => {
  try {
    await sendEmail({
      to,
      subject: 'Welcome to The Clouds Academy',
      template: 'welcome',
      context: { 
        name, 
        loginUrl: `${config.frontendUrl}/login`,
        year: new Date().getFullYear()
      },
    });
    logger.info(`✅ Welcome email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('❌ Welcome email failed:', err);
    return false;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (to, token, name) => {
  try {
    const resetUrl = `${config.frontendUrl}/reset-password/${token}`;
    await sendEmail({
      to,
      subject: 'Password Reset Request - The Clouds Academy',
      template: 'forgot-password',
      context: { 
        name, 
        resetUrl, 
        expiresIn: '30 minutes',
        year: new Date().getFullYear()
      },
    });
    logger.info(`✅ Password reset email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('❌ Password reset email failed:', err);
    return false;
  }
};

/**
 * Send fee reminder email
 */
export const sendFeeReminderEmail = async (to, { studentName, voucherNumber, amount, dueDate }) => {
  try {
    await sendEmail({
      to,
      subject: `Fee Reminder - ${studentName}`,
      template: 'fee-reminder',
      context: { 
        studentName, 
        voucherNumber, 
        amount, 
        dueDate,
        year: new Date().getFullYear()
      },
    });
    logger.info(`✅ Fee reminder sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('❌ Fee reminder email failed:', err);
    return false;
  }
};

/**
 * Send invoice email
 */
export const sendInvoiceEmail = async (to, invoice) => {
  try {
    await sendEmail({
      to,
      subject: `Invoice #${invoice.invoice_number} - The Clouds Academy`,
      template: 'invoice',
      context: { 
        invoice,
        year: new Date().getFullYear()
      },
    });
    logger.info(`✅ Invoice email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('❌ Invoice email failed:', err);
    return false;
  }
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendFeeReminderEmail,
  sendInvoiceEmail,
  sendWelcomeEmailWithCredentials
};