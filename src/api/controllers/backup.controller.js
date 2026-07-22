import { triggerDatabaseBackup } from '../../services/backup.service.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import { AppError } from '../../utils/lib/AppError.js';

export const triggerBackup = async (req, res, next) => {
  try {
    const result = await triggerDatabaseBackup();
    return sendSuccess(res, result, 'Database backup completed and uploaded successfully');
  } catch (error) {
    next(new AppError(error.message || 'Backup failed', 500));
  }
};
