import models from '../../models/postgres/index.js';
import logger from '../../config/logger.js';

const { AuditLog } = models;

/**
 * Creates an Audit Log entry tracking user actions.
 * @param {Object} options
 * @param {Object} options.req - The Express request object (used to extract user, IP, UA).
 * @param {String} options.action - Action name (e.g., 'CREATE_INSTITUTE').
 * @param {String} options.entity - Entity name (e.g., 'Institute').
 * @param {String} options.entity_id - UUID of the affected entity.
 * @param {Object} [options.old_values] - Previous state of the entity (for updates/deletes).
 * @param {Object} [options.new_values] - New state of the entity (for creates/updates).
 * @param {String} [options.institute_id] - Optional ID of the institute context.
 */
export const logAuditAction = async ({ req, action, entity, entity_id, old_values = null, new_values = null, institute_id = null }) => {
  try {
    const user_id = req?.user?.id;
    if (!user_id) {
      logger.warn(`Audit Log skipped: No user found in request for action ${action}`);
      return;
    }

    const ip_address = req?.ip || req?.headers['x-forwarded-for'] || req?.connection?.remoteAddress || 'Unknown';
    const user_agent = req?.headers['user-agent'] || 'Unknown';

    await AuditLog.create({
      user_id,
      institute_id,
      action,
      entity,
      entity_id,
      old_values,
      new_values,
      ip_address,
      user_agent
    });

  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};
