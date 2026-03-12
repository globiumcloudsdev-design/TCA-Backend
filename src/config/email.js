/**
 * The Clouds Academy - Email Configuration (Nodemailer + Handlebars)
 */

import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './index.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: config.email.auth,
  tls: { rejectUnauthorized: false },
});

// Handlebars template engine
transporter.use(
  'compile',
  hbs({
    viewEngine: {
      extname: '.hbs',
      partialsDir: path.join(__dirname, '../templates/email'),
      defaultLayout: false,
    },
    viewPath: path.join(__dirname, '../templates/email'),
    extName: '.hbs',
  })
);

/**
 * Send email helper
 */
export const sendEmail = async ({ to, subject, template, context, attachments = [] }) => {
  try {
    const info = await transporter.sendMail({
      from: `"The Clouds Academy" <${config.email.from}>`,
      to,
      subject,
      template,
      context,
      attachments,
    });
    logger.info(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`❌ Email failed to ${to}:`, error);
    throw error;
  }
};

export { transporter };
export default transporter;
