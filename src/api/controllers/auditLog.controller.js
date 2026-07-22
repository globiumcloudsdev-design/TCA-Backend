import { Op } from 'sequelize';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendPaginated } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';

const { AuditLog, User } = models;

/**
 * Get Audit Logs with Pagination and Filtering
 */
export const getAuditLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, search, action, entity, user_id, start_date, end_date } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (user_id) where.user_id = user_id;

  if (start_date || end_date) {
    where.created_at = {};
    if (start_date) where.created_at[Op.gte] = new Date(start_date);
    if (end_date) where.created_at[Op.lte] = new Date(end_date + 'T23:59:59');
  }

  // Filter if view_own_data is enabled (though audit logs are system level, maybe restrict to their own logs?)
  // Usually audit logs are for Master Admin to see all, but if view_own_data is true, restrict to their own user_id
  if (req.user?.details?.view_own_data) {
    where.user_id = req.user.id;
  }

  // Optional: Global Search across IP, UserAgent
  if (search) {
    where[Op.or] = [
      { action: { [Op.iLike]: `%${search}%` } },
      { entity: { [Op.iLike]: `%${search}%` } },
      { ip_address: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Define include mapping
  // Assuming User model has relation with AuditLog. If not, we fetch users separately or map them manually.
  // Actually, we'll map them manually to be safe if no association exists.
  
  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
    raw: true,
  });

  // Fetch users for the logs to display names
  const userIds = [...new Set(rows.map(log => log.user_id).filter(id => id))];
  const users = await User.findAll({
    where: { id: userIds },
    attributes: ['id', 'first_name', 'last_name', 'email', 'user_type'],
    raw: true
  });
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  const enrichedRows = rows.map(log => ({
    ...log,
    User: userMap[log.user_id] || { first_name: 'System', last_name: 'Process', email: 'N/A' }
  }));

  sendPaginated(res, enrichedRows, {
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(count / parseInt(limit))
  }, 'Audit logs fetched successfully');
});
