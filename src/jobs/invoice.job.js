/**
 * The Clouds Academy - Invoice Job
 * Generates monthly SaaS invoices for all active subscriptions
 */

import SchoolSubscription from '../models/postgres/SchoolSubscription.model.js';
import Invoice from '../models/postgres/Invoice.model.js';
import logger from '../config/logger.js';
import { Op } from 'sequelize';

export const runInvoiceJob = async () => {
  try {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 7);

    // Find active subscriptions due for renewal
    const subscriptions = await SchoolSubscription.findAll({
      where: {
        status: 'active',
        auto_renew: true,
        ends_at: { [Op.lte]: dueDate },
      },
    });

    let created = 0;

    for (const sub of subscriptions) {
      // Check if invoice already exists for this cycle
      const exists = await Invoice.findOne({
        where: {
          subscription_id: sub.id,
          due_date: dueDate.toISOString().split('T')[0],
        },
      });

      if (!exists) {
        await Invoice.create({
          school_id: sub.school_id,
          subscription_id: sub.id,
          invoice_number: `INV-${Date.now()}`,
          amount: sub.amount_paid || 0,
          total: sub.amount_paid || 0,
          status: 'sent',
          due_date: dueDate.toISOString().split('T')[0],
        });
        created++;
      }
    }

    logger.info(`✅ Invoice Job: ${created} invoices generated`);
  } catch (err) {
    logger.error('❌ Invoice Job failed:', err);
  }
};
