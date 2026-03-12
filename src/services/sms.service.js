/**
 * The Clouds Academy - SMS Service (Twilio)
 */

import { sendSMS } from '../config/sms.js';
import logger from '../config/logger.js';

export const sendOTP = async (phone, otp) => {
  await sendSMS(phone, `Your The Clouds Academy OTP is: ${otp}. Valid for 5 minutes.`);
};

export const sendFeeReminderSMS = async (phone, { studentName, amount, dueDate }) => {
  const msg = `Dear Parent, Fee of Rs.${amount} for ${studentName} is due on ${dueDate}. Please pay on time. -The Clouds Academy`;
  await sendSMS(phone, msg);
};

export const sendAttendanceAlertSMS = async (phone, { studentName, status, date }) => {
  const statusText = status === 'absent' ? 'ABSENT' : 'LATE';
  const msg = `Alert: ${studentName} was marked ${statusText} on ${date}. -The Clouds Academy`;
  await sendSMS(phone, msg);
};

export default { sendOTP, sendFeeReminderSMS, sendAttendanceAlertSMS };
