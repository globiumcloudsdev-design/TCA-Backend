/**
 * The Clouds Academy - SMS Configuration (Twilio)
 */

import twilio from 'twilio';
import config from './index.js';
import logger from './logger.js';

const client = twilio(config.sms.accountSid, config.sms.authToken);

/**
 * Send SMS
 */
export const sendSMS = async (to, body) => {
  try {
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
