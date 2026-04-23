import { sendSuccess, sendPaginated, sendError, sendNotFound } from '../../../utils/helpers/response.helper.js';
import * as payrollService from '../../../services/payrollGeneration.service.js';

export const getMyPayslips = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const instituteId = req.user.institute_id || req.user.school_id;

    const filters = {
      institute_id: instituteId,
      staff_id: teacherId,
      month: req.query.month,
      year: req.query.year,
      status: req.query.status,
    };
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy || 'generated_at',
      sortOrder: req.query.sortOrder || 'DESC',
    };

    const result = await payrollService.getPayslips(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'My payslips fetched');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const getMyPayslipById = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const instituteId = req.user.institute_id || req.user.school_id;

    const payslip = await payrollService.getPayslipById(req.params.id, instituteId);
    if (payslip.staff_id !== teacherId) {
      return sendError(res, 'Unauthorized access', 403);
    }
    return sendSuccess(res, payslip, 'Payslip fetched');
  } catch (error) {
    if (error.message === 'Payslip not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const getMyPayrollYears = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const instituteId = req.user.institute_id || req.user.school_id;

    const years = await payrollService.getDistinctYearsForStaff(teacherId, instituteId);
    return sendSuccess(res, years, 'Years fetched');
  } catch (error) {
    return sendError(res, error.message);
  }
};