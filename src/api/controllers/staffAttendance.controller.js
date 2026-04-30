// backend/src/controllers/staffAttendance.controller.js
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest,
} from '../../utils/helpers/response.helper.js';
import * as staffAttendanceService from '../../services/staffAttendance.service.js';
import models from '../../models/postgres/index.js';
import upload from '../../api/middlewares/upload.middleware.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

export const markAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);

    const data = {
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId || req.user.branch_id,
      marked_by: req.user.id,
    };
    const attendance = await staffAttendanceService.markAttendance(data);
    return sendCreated(res, attendance, 'Attendance marked successfully');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const bulkMarkAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    if (!req.file) return sendBadRequest(res, 'CSV file is required');

    const result = await staffAttendanceService.bulkMarkAttendance(instituteId, req.user.id, req.file.buffer);
    return sendSuccess(res, result, 'Bulk upload processed');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const getAllAttendances = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);

    const filters = {
      institute_id: instituteId,
      branch_id: branchId,
      staff_id: req.query.staff_id,
      status: req.query.status,
      staff_type: req.query.staff_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy || 'date',
      sortOrder: req.query.sortOrder || 'DESC',
    };
    const result = await staffAttendanceService.getAllAttendances(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Attendances fetched');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const getAttendanceById = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const attendance = await staffAttendanceService.getAttendanceById(req.params.id, instituteId);
    return sendSuccess(res, attendance, 'Attendance record fetched');
  } catch (error) {
    if (error.message === 'Attendance record not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const attendance = await staffAttendanceService.updateAttendance(req.params.id, instituteId, req.body, req.user.id);
    return sendSuccess(res, attendance, 'Attendance updated');
  } catch (error) {
    if (error.message === 'Attendance record not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const result = await staffAttendanceService.deleteAttendance(req.params.id, instituteId);
    return sendSuccess(res, null, result.message);
  } catch (error) {
    if (error.message === 'Attendance record not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);

    const filters = {
      institute_id: instituteId,
      branch_id: branchId,
      staff_type: req.query.staff_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    const report = await staffAttendanceService.getAttendanceReport(filters);
    return sendSuccess(res, report, 'Attendance report generated');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const markHoliday = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);

    const result = await staffAttendanceService.markHoliday({
      ...req.body,
      institute_id: instituteId,
      branch_id: branchId,
      marked_by: req.user.id,
    });

    return sendSuccess(res, result, 'Staff holiday marked successfully');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const uploadMiddleware = upload.single('file');