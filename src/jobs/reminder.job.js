/**
 * The Clouds Academy - Fee Reminder Job
 * Sends SMS/email reminders for pending/overdue fee vouchers
 */

import models from '../models/postgres/index.js';
import { sendFeeReminderSMS } from '../services/sms.service.js';
import logger from '../config/logger.js';
import { Op } from 'sequelize';
import { notifyStudentsAndParents } from '../services/push/events.js';

const { FeeVoucher, User } = models;

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
          model: User,
          as: 'Student',
        },
      ],
      limit: 500,
    });

    let sent = 0;

    for (const voucher of overdueVouchers) {
      if (!voucher.Student) continue;

      // Push + inbox to student and parents; at most once per voucher per user per day (PKT)
      notifyStudentsAndParents({
        instituteId: voucher.institute_id,
        studentIds: [voucher.student_id],
        label: 'fee due reminder',
        options: { dedupePerDay: true },
        payload: {
          type: 'fee_due',
          branch_id: voucher.branch_id || null,
          title: 'Fee due reminder',
          body: `${voucher.Student.first_name}'s fee voucher #${voucher.voucher_number} (PKR ${voucher.net_amount}) was due on ${voucher.due_date}.`,
          entity_id: voucher.id,
          data: { student_id: voucher.student_id, voucher_number: voucher.voucher_number, due_date: voucher.due_date, amount_due: voucher.net_amount },
        },
      });

      // Find parents for this student
      // Logic: Parents have student's ID in their details.parentDetails.student_ids
      const parents = await User.findAll({
        where: {
          school_id: voucher.institute_id,
          user_type: 'PARENT',
          is_active: true
        }
      });

      const linkedParents = parents.filter(p => {
        const studentIds = p.details?.parentDetails?.student_ids || [];
        return studentIds.includes(voucher.student_id);
      });

      const parent = linkedParents[0]; // Take the first linked parent
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
