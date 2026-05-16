/**
 * The Clouds Academy - System Orchestrator Job
 * Central trigger for all daily background tasks
 */

import { runSaaSJob } from './saas.job.js';
import { runAttendanceJob } from './attendance.job.js';
import { runCleanupJob } from './cleanup.job.js';
import { runReminderJob } from './reminder.job.js';
import logger from '../config/logger.js';

/**
 * Main Orchestrator: Runs all daily tasks in sequence
 */
export const runSystemDailyJobs = async () => {
    logger.info('🔔 Starting Global System Daily Jobs Orchestrator...');
    const startTime = Date.now();

    try {
        // 1. Process SaaS Tasks (Trials, Invoices)
        logger.info('--- Step 1: Running SaaS Job ---');
        await runSaaSJob();

        // 2. Process Attendance (Auto-absent)
        logger.info('--- Step 2: Running Attendance Job ---');
        await runAttendanceJob();

        // 3. Process Reminders (Fee etc)
        logger.info('--- Step 3: Running Reminder Job ---');
        await runReminderJob();

        // 4. Cleanup (Temp files)
        logger.info('--- Step 4: Running Cleanup Job ---');
        await runCleanupJob();

        const duration = (Date.now() - startTime) / 1000;
        logger.info(`✨ All Global Daily Jobs Completed Successfully in ${duration}s`);
    } catch (err) {
        logger.error('💥 Critical failure in Global System Daily Jobs:', err);
    }
};
