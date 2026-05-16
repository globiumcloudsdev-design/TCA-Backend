# The Clouds Academy - Background Jobs System

This directory contains all automated background tasks (Cron Jobs) for the platform. All daily tasks are orchestrated to run at a specific time for maximum performance and reliability.

## Core Structure

### 1. `index.js` (Initializer)
The main entry point for the jobs system. It is called by `server.js` on startup. It schedules the `runSystemDailyJobs` orchestrator to run every day at **Midnight (00:00)**.

### 2. `system.job.js` (Orchestrator)
The central trigger. Instead of scheduling multiple cron jobs, we use this single orchestrator to call each specialized job in sequence:
1. **SaaS Job** (Trials/Invoices)
2. **Attendance Job** (Student/Staff/Teacher)
3. **Reminder Job** (Fee Reminders)
4. **Cleanup Job** (Temp Files)

## Specialized Jobs

### `saas.job.js`
Handles all platform-level subscription logic:
- **Trial Expiration**: Automatically checks for institutes whose trial has ended and marks them as `expired`.
- **Monthly Invoices**: Checks all active institutes and generates their monthly subscription invoice if it hasn't been generated yet for the current cycle.

### `attendance.job.js`
Handles auto-marking of absentees for the previous day:
- **Students**: Marks absent if they had a class scheduled in their timetable but no attendance was recorded.
- **Teachers**: Marks absent if they had a period scheduled in any timetable but no staff attendance was recorded.
- **Staff**: Marks absent if it was a working day (based on Institute Settings) and no attendance was recorded.

### `reminder.job.js`
Sends automated notifications (In-app/Email/SMS) for pending fee vouchers and other reminders.

### `cleanup.job.js`
Performs system maintenance by deleting temporary files and logs that are older than a specific threshold.

---

**Note:** All jobs use the `node-cron` library and are designed to be idempotent (can be run multiple times without causing duplicate records).
