import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';
import { Op } from 'sequelize';
import { logAuditAction } from '../../utils/helpers/auditLogger.js';

const { GlobalAnnouncement } = models;

/**
 * Manage announcements (Master Admin)
 */

export const getAnnouncements = catchAsync(async (req, res) => {
  const where = {};
  
  if (req.user?.details?.view_own_data) {
    where[Op.or] = [
      { created_by: req.user.id },
      { updated_by: req.user.id }
    ];
  }
  
  const announcements = await GlobalAnnouncement.findAll({
    where,
    order: [['created_at', 'DESC']]
  });
  sendSuccess(res, announcements, 'Announcements fetched');
});

export const createAnnouncement = catchAsync(async (req, res) => {
  const announcement = await GlobalAnnouncement.create({
    ...req.body,
    created_by: req.user.id,
    updated_by: req.user.id
  });

  await logAuditAction({
    req,
    action: 'CREATE_ANNOUNCEMENT',
    entity: 'GlobalAnnouncement',
    entity_id: announcement.id,
    new_values: announcement.toJSON()
  });

  sendCreated(res, announcement, 'Announcement created');
});

export const updateAnnouncement = catchAsync(async (req, res) => {
  const announcement = await GlobalAnnouncement.findByPk(req.params.id);
  if (!announcement) throw new Error('Announcement not found');
  
  const old_values = announcement.toJSON();

  await announcement.update({
    ...req.body,
    updated_by: req.user.id
  });

  await logAuditAction({
    req,
    action: 'UPDATE_ANNOUNCEMENT',
    entity: 'GlobalAnnouncement',
    entity_id: announcement.id,
    old_values,
    new_values: announcement.toJSON()
  });

  sendSuccess(res, announcement, 'Announcement updated');
});

export const deleteAnnouncement = catchAsync(async (req, res) => {
  const announcement = await GlobalAnnouncement.findByPk(req.params.id);
  if (!announcement) throw new Error('Announcement not found');
  
  const old_values = announcement.toJSON();
  await announcement.destroy();

  await logAuditAction({
    req,
    action: 'DELETE_ANNOUNCEMENT',
    entity: 'GlobalAnnouncement',
    entity_id: req.params.id,
    old_values
  });

  sendNoContent(res);
});

/**
 * Fetch announcements for display (Institutes)
 */
export const getActiveAnnouncements = catchAsync(async (req, res) => {
  const school_id = req.user.school_id;
  
  const announcements = await GlobalAnnouncement.findAll({
    where: {
      is_active: true,
      [Op.or]: [
        { target_type: 'all' },
        { 
          target_type: 'specific',
          target_institutes: {
            [Op.contains]: [school_id]
          }
        }
      ],
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } }
      ]
    },
    order: [['created_at', 'DESC']]
  });

  sendSuccess(res, announcements, 'Active announcements fetched');
});
