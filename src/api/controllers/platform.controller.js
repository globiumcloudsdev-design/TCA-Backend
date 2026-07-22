import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';
import { getIO } from '../../sockets/index.js';
import logger from '../../config/logger.js';
import { logAuditAction } from '../../utils/helpers/auditLogger.js';

const { GlobalSetting } = models;

/**
 * Get all global settings
 */
export const getGlobalSettings = catchAsync(async (req, res) => {
  const settings = await GlobalSetting.findAll();
  
  // Convert array to object for easier frontend usage
  const settingsObj = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  sendSuccess(res, settingsObj, 'Global settings fetched');
});

/**
 * Update a specific global setting
 */
export const updateGlobalSetting = catchAsync(async (req, res) => {
  const { key, value } = req.body;

  let setting = await GlobalSetting.findByPk(key);
  
  if (setting) {
    await setting.update({ 
      value,
      updated_by: req.user.id
    });
  } else {
    setting = await GlobalSetting.create({
      key,
      value,
      updated_by: req.user.id
    });
  }

  // Real-time broadcast to all clients via Socket.io
  try {
    const io = getIO();
    io.emit('platform_settings:update', { key, value: setting.value });
    logger.info(`⚡ Broadcasted platform setting update [${key}] via Socket.io`);
  } catch (error) {
    logger.warn(`⚠️ Socket.io broadcast skipped (server initializing or error): ${error.message}`);
  }

  await logAuditAction({
    req,
    action: 'UPDATE_GLOBAL_SETTING',
    entity: 'GlobalSetting',
    entity_id: key,
    new_values: { key, value: setting.value }
  });

  sendSuccess(res, setting.value, `Global setting ${key} updated`);
});
