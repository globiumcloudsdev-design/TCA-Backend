/**
 * The Clouds Academy - Attendance Background Jobs
 * Auto-marks absentees for Students and Staff
 */

import { subDays, format } from 'date-fns';
import { 
    autoMarkAbsent as autoMarkStudentAbsent,
    autoMarkTeacherAbsent,
    autoMarkStaffAbsent
} from '../services/autoAttendance.service.js';
import logger from '../config/logger.js';

/**
 * Job: Auto-mark absentees
 */
export const runAttendanceJob = async () => {
    try {
        // Correctly calculate "Yesterday" in Local Time to avoid UTC shift issues at midnight
        const targetDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        
        logger.info(`🚀 Starting Attendance Job for ${targetDate}`);

        // 1. Auto-mark Students
        await autoMarkStudentAbsent(null, targetDate);

        // 2. Auto-mark Teachers (Based on Timetable Periods)
        await autoMarkTeacherAbsent(null, targetDate);

        // 3. Auto-mark General Staff (Based on Weekly Off Days)
        await autoMarkStaffAbsent(null, targetDate);

        logger.info('✅ Global Attendance Job completed');

    } catch (err) {
        logger.error('❌ Attendance Job failed:', err);
    }
};
