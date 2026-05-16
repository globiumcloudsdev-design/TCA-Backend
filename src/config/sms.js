/**
 * The Clouds Academy - SMS Configuration (Twilio)
 */

import twilio from 'twilio';
import config from './index.js';
import logger from './logger.js';

let client = null;
if (config.sms.accountSid && config.sms.authToken) {
  client = twilio(config.sms.accountSid, config.sms.authToken);
} else {
  logger.warn('⚠️ Twilio credentials missing. SMS service will not work.');
}

/**
 * Send SMS
 */
export const sendSMS = async (to, body) => {
  try {
    if (!client) {
      logger.warn(`🚫 Skipping SMS to ${to}: Twilio client not initialized`);
      return null;
    }

    const message = await client.messages.create({
      body,
      from: config.sms.fromNumber,
      to,
    });
    logger.info(`✅ SMS sent to ${to}: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error(`❌ SMS failed to ${to}:`, error);
    throw error;
  }
};

export default { sendSMS };
