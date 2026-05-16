/**
 * The Clouds Academy - Jobs Scheduler
 * node-cron based background jobs
 */

import cron from 'node-cron';
import logger from '../config/logger.js';

// Import jobs
import { runSystemDailyJobs } from './system.job.js';

export const initJobs = () => {
  // Global System Daily Job - Runs at 00:00 (Midnight)
  // This orchestrates SaaS (Trials/Invoices), Attendance, Reminders, and Cleanup
  cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Triggering: Global System Daily Jobs');
    await runSystemDailyJobs();
  });

  logger.info('✅ Centralized background jobs initialized');
};

export default initJobs;
