// backend/src/controllers/timetable.controller.js

/**
 * The Clouds Academy - Timetable Controller
 * 
 * Yeh controller request/response handle karta hai:
 * - Request se data nikalta hai
 * - Service ko call karta hai
 * - Response bhejta hai
 */

import * as timetableService from '../../services/timetable.service.js';
import models from '../../models/postgres/index.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound
} from '../../utils/helpers/response.helper.js';

const { sequelize } = models;

/**
 * Helper function: Request se institute ID nikalta hai
 */
const getInstituteId = (req) => {
  return req.user?.institute_id || req.user?.school_id;
};

/**
 * GET /api/v1/timetable/entities
 * ------------------------------
 * Yeh endpoint entities fetch karta hai dropdown ke liye
 */
export const getEntities = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const { academic_year_id } = req.query;
    
    console.log('📋 Entities fetch ho rahi hain, institute:', instituteId);

    const entities = await timetableService.getTimetableEntities(instituteId, academic_year_id);

    return sendSuccess(res, entities, 'Entities fetch ho gayin');
  } catch (error) {
    console.error('❌ Entities fetch error:', error);
    return sendError(res, error.message || 'Entities fetch nahi ho sakin', 500);
  }
};

/**
 * POST /api/v1/timetable
 * ----------------------
 * Naya timetable create karta hai
 */
export const createTimetable = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    console.log('📥 Timetable create ho raha hai:', req.body);

    const timetableData = {
      ...req.body,
      school_id: instituteId,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const timetable = await timetableService.createTimetable(timetableData, { transaction });
    await transaction.commit();

    return sendCreated(res, timetable, 'Timetable create ho gaya');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Timetable create error:', error);
    return sendError(res, error.message || 'Timetable create nahi ho saka', 400);
  }
};

/**
 * GET /api/v1/timetable
 * ---------------------
 * Saare timetables fetch karta hai
 */
export const getAllTimetables = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const filters = {
      institute_id: instituteId,
      academic_year_id: req.query.academic_year_id,
      entity_type: req.query.entity_type,
      class_id: req.query.class_id,
      section_id: req.query.section_id,
      course_id: req.query.course_id,
      batch_id: req.query.batch_id,
      department_id: req.query.department_id,
      program_id: req.query.program_id,
      semester_id: req.query.semester_id,
      is_active: req.query.is_active
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    console.log('📥 Timetables fetch ho rahe hain filters ke saath:', filters);

    const result = await timetableService.getAllTimetables(filters, pagination);

    return sendPaginated(res, result.data, result.pagination, 'Timetables fetch ho gaye');
  } catch (error) {
    console.error('❌ Timetables fetch error:', error);
    return sendError(res, error.message || 'Timetables fetch nahi ho sakin', 500);
  }
};

/**
 * GET /api/v1/timetable/:id
 * -------------------------
 * Ek timetable ki details fetch karta hai
 */
export const getTimetableById = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    console.log('🔍 Timetable dhond rahe hain:', id);

    const timetable = await timetableService.getTimetableById(id, instituteId);

    if (!timetable) {
      return sendNotFound(res, 'Timetable nahi mila');
    }

    return sendSuccess(res, timetable, 'Timetable mil gaya');
  } catch (error) {
    console.error('❌ Timetable fetch error:', error);
    return sendError(res, error.message || 'Timetable fetch nahi ho saka', 500);
  }
};

/**
 * PUT /api/v1/timetable/:id
 * -------------------------
 * Timetable update karta hai
 */
export const updateTimetable = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      await transaction.rollback();
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    console.log('📝 Timetable update ho raha hai:', id);

    const updateData = {
      ...req.body,
      updated_by: req.user.id
    };

    const updatedTimetable = await timetableService.updateTimetable(
      id,
      instituteId,
      updateData,
      { transaction }
    );

    await transaction.commit();

    return sendSuccess(res, updatedTimetable, 'Timetable update ho gaya');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Timetable update error:', error);

    if (error.message === '❌ Timetable nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Timetable update nahi ho saka', 400);
  }
};

/**
 * DELETE /api/v1/timetable/:id
 * ----------------------------
 * Timetable delete karta hai
 */
export const deleteTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    console.log('🗑️ Timetable delete ho raha hai:', id);

    const result = await timetableService.deleteTimetable(id, instituteId);

    return sendSuccess(res, null, result.message);
  } catch (error) {
    console.error('❌ Timetable delete error:', error);
    if (error.message === '❌ Timetable nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Timetable delete nahi ho saka', 500);
  }
};

/**
 * PATCH /api/v1/timetable/:id/toggle-status
 * -----------------------------------------
 * Timetable ko activate/deactivate karta hai
 */
export const toggleTimetableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const instituteId = getInstituteId(req);

    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    if (is_active === undefined) {
      return sendError(res, 'is_active field zaroori hai', 400);
    }

    console.log('🔄 Timetable status change ho raha hai:', id);

    const timetable = await timetableService.toggleTimetableStatus(id, instituteId, is_active);

    return sendSuccess(res, timetable, `Timetable ${is_active ? 'activate' : 'deactivate'} ho gaya`);
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    if (error.message === '❌ Timetable nahi mila') {
      return sendNotFound(res, error.message);
    }
    return sendError(res, error.message || 'Status change nahi ho saka', 500);
  }
};

/**
 * POST /api/v1/timetable/check-conflict
 * -------------------------------------
 * Teacher conflict check karta hai
 */
export const checkTeacherConflict = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const { teacher_id, day, period, start_time, end_time, exclude_id } = req.body;

    if (!teacher_id || !day) {
      return sendError(res, 'teacher_id aur day zaroori hain', 400);
    }

    console.log('🔍 Teacher conflict check ho raha hai:', { teacher_id, day, period });

    const hasConflict = await timetableService.checkTeacherConflict(
      instituteId,
      teacher_id,
      day,
      period,
      start_time,
      end_time,
      exclude_id
    );

    return sendSuccess(res, { hasConflict }, 'Conflict check complete');
  } catch (error) {
    console.error('❌ Conflict check error:', error);
    return sendError(res, error.message || 'Conflict check nahi ho saka', 500);
  }
};

// backend/src/controllers/timetable.controller.js

/**
 * GET /api/v1/timetable/busy-teachers
 * ------------------------------------
 * Specific day aur period ke liye busy teachers fetch karta hai
 */
export const getBusyTeachers = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendError(res, 'Institute ID nahi mila', 400);
    }

    const { day, period, start_time, end_time, exclude_timetable_id, class_id, section_id } = req.query;

    if (!day) {
      return sendError(res, 'day parameter zaroori hai', 400);
    }

    console.log('🔍 Busy teachers fetch ho rahe hain:', { day, period, class_id, section_id });

    const busyTeachers = await timetableService.getBusyTeachers(
      instituteId,
      day,
      period,
      start_time,
      end_time,
      exclude_timetable_id,
      class_id,
      section_id
    );

    return sendSuccess(res, { busyTeachers }, 'Busy teachers fetch ho gaye');
  } catch (error) {
    console.error('❌ Busy teachers fetch error:', error);
    return sendError(res, error.message || 'Busy teachers fetch nahi ho sakin', 500);
  }
};