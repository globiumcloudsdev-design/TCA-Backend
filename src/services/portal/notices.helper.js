/**
 * Notices for portal users, built on the existing Notification model
 * (no separate Notice table exists). A user sees notifications addressed to
 * them (or to children, for parents) plus institute broadcasts (user_id NULL),
 * always scoped by institute and, for broadcasts, by branch.
 */
import { Op } from 'sequelize';
import { format } from 'date-fns';
import models from '../../models/postgres/index.js';

const { Notification } = models;

export const formatNotice = (n) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  message: n.body,
  type: n.type,
  category: n.type === 'fee' ? 'Fee' : n.type === 'exam' ? 'Exam' : n.type === 'attendance' ? 'Attendance' : 'General',
  priority: n.data?.priority || (n.type === 'alert' ? 'high' : 'medium'),
  date: n.created_at ? format(new Date(n.created_at), 'dd MMM yyyy') : null,
  author: n.data?.author || 'School Administration',
  is_read: n.is_read,
  created_at: n.created_at,
});

export const fetchNotices = async ({ instituteId, branchId = null, userIds = [], type, is_read, limit = 20, page = 1 }) => {
  if (!instituteId || !Notification) {
    return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
  }
  const ids = userIds.filter(Boolean);
  const broadcast = { user_id: null };
  const branchCond = branchId ? { [Op.or]: [{ branch_id: null }, { branch_id: branchId }] } : {};

  const where = {
    institute_id: instituteId,
    [Op.and]: [
      {
        [Op.or]: [
          ...(ids.length ? [{ user_id: { [Op.in]: ids } }] : []),
          { [Op.and]: [broadcast, branchCond] },
        ],
      },
    ],
  };
  if (type && type !== 'all') where.type = type;
  if (is_read !== undefined) where.is_read = is_read;

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });
  return {
    data: rows.map(formatNotice),
    pagination: { total: count, page: safePage, limit: safeLimit, totalPages: Math.ceil(count / safeLimit) },
  };
};

export default { fetchNotices, formatNotice };
