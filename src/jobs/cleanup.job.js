/**
 * The Clouds Academy - Cleanup Job
 * Removes temp uploaded files older than 24 hours
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '../../public/uploads/temp');
const MAX_AGE_HOURS = 24;

export const runCleanupJob = async () => {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

      if (ageHours > MAX_AGE_HOURS) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    logger.info(`✅ Cleanup Job: ${deleted} temp files deleted`);
  } catch (err) {
    logger.error('❌ Cleanup Job failed:', err);
  }
};
