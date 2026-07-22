import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const execAsync = util.promisify(exec);

export const triggerDatabaseBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `db-backup-${timestamp}.sql`;
    const backupFilePath = path.join(process.cwd(), backupFileName);
    const cloudinaryFolder = 'the-clouds-academy/backup';

    // 1. Generate Backup using pg_dump
    // Production-ready: relies on 'pg_dump' being in the system PATH. 
    // Fallback to specific Windows path for local development if not in PATH.
    const pgDumpPath = process.env.PG_DUMP_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe' : 'pg_dump');
    
    const dbConfig = config.database;
    // We pass the password securely via environment variables to avoid terminal injection/parsing issues
    const command = `"${pgDumpPath}" -U ${dbConfig.user} -h ${dbConfig.host} -p ${dbConfig.port} -d ${dbConfig.name} -F p -f "${backupFilePath}"`;
    
    logger.info(`Starting database backup: ${backupFileName}`);
    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: dbConfig.password
      }
    });
    logger.info(`Database backup created locally at ${backupFilePath}`);

    // 2. Delete Old Backups from Cloudinary
    logger.info(`Cleaning up old backups in ${cloudinaryFolder}`);
    const searchResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: cloudinaryFolder,
      max_results: 100,
    });
    
    const resources = searchResult.resources || [];
    for (const file of resources) {
      await deleteFromCloudinary(file.public_id, file.resource_type);
    }
    
    // 3. Upload New Backup to Cloudinary
    logger.info(`Uploading new backup to Cloudinary...`);
    const uploadResult = await uploadToCloudinary(backupFilePath, cloudinaryFolder, {
      resource_type: 'raw',
      format: 'sql',
      public_id: `db-backup-${timestamp}`
    });

    // 4. Delete Local Temp File
    await fs.unlink(backupFilePath);
    logger.info(`Local temp backup file deleted.`);

    return {
      success: true,
      url: uploadResult.url,
      size: uploadResult.size,
      filename: `db-backup-${timestamp}.sql`,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Database backup failed:', error);
    throw new Error('Failed to generate and upload database backup. Ensure pg_dump is available and DB credentials are correct.');
  }
};
