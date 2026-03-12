/**
 * The Clouds Academy - Jobs Scheduler
 * node-cron based background jobs
 */

import cron from 'node-cron';
import logger from '../config/logger.js';

// Import jobs
import { runInvoiceJob } from './invoice.job.js';
import { runReminderJob } from './reminder.job.js';
import { runCleanupJob } from './cleanup.job.js';

export const initJobs = () => {
  // Generate monthly invoices everyday at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Running: Invoice Job');
    await runInvoiceJob();
  });

  // Send fee reminders every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('⏰ Running: Fee Reminder Job');
    await runReminderJob();
  });

  // Cleanup temp files every Sunday at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    logger.info('⏰ Running: Cleanup Job');
    await runCleanupJob();
  });

  logger.info('✅ Background jobs initialized');
};

export default initJobs;
