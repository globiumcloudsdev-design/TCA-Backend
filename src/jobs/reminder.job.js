/**
 * The Clouds Academy - Fee Reminder Job
 * Sends SMS/email reminders for pending/overdue fee vouchers
 */

import FeeVoucher from '../models/postgres/FeeVoucher.model.js';
import Student from '../models/postgres/Student.model.js';
import Parent from '../models/postgres/Parent.model.js';
import { sendFeeReminderSMS } from '../services/sms.service.js';
import logger from '../config/logger.js';
import { Op } from 'sequelize';

export const runReminderJob = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const overdueVouchers = await FeeVoucher.findAll({
      where: {
        status: { [Op.in]: ['pending', 'overdue'] },
        due_date: { [Op.lt]: today },
      },
      include: [
        {
          model: Student,
          include: [Parent],
        },
      ],
      limit: 500,
    });

    let sent = 0;

    for (const voucher of overdueVouchers) {
      const parent = voucher.Student?.Parents?.[0];
      if (parent?.phone) {
        try {
          await sendFeeReminderSMS(parent.phone, {
            studentName: `${voucher.Student.first_name} ${voucher.Student.last_name}`,
            amount: voucher.net_amount,
            dueDate: voucher.due_date,
          });
          sent++;
        } catch (err) {
          logger.warn(`SMS failed for voucher ${voucher.id}`);
        }
      }
    }

    logger.info(`✅ Reminder Job: ${sent} SMS sent`);
  } catch (err) {
    logger.error('❌ Reminder Job failed:', err);
  }
};
