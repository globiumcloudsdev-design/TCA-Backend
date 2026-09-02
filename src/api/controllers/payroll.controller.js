import sequelize from '../../config/database.js';
import Payslip from '../../models/postgres/Payslip.model.js';
import * as payrollService from '../../services/payrollGeneration.service.js';
import { sendSuccess, sendCreated, sendPaginated, sendError, sendNotFound, sendBadRequest } from '../../utils/helpers/response.helper.js';
import { getInstituteId, getBranchId } from '../../utils/helpers/request.helper.js';

export const generatePayroll = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);
    const { month, year, category, staff_ids } = req.body;
    if (!month || !year) return sendBadRequest(res, 'Month and year are required');

    const result = await payrollService.generatePayroll(instituteId, req.user.id, {
      month: parseInt(month),
      year: parseInt(year),
      category,
      staffIds: staff_ids,
      branchId
    });
    return sendSuccess(res, result, 'Payroll generation completed');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const getAllPayslips = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');

    const branchId = getBranchId(req);

    const filters = {
      institute_id: instituteId,
      branch_id: branchId || req.query.branch_id,
      staff_id: req.query.staff_id,
      month: req.query.month,
      year: req.query.year,
      status: req.query.status,
    };
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };
    const result = await payrollService.getPayslips(filters, pagination);
    return sendPaginated(res, result.data, result.pagination, 'Payslips fetched');
  } catch (error) {
    return sendError(res, error.message);
  }
};

export const getPayslipById = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const payslip = await payrollService.getPayslipById(req.params.id, instituteId);
    return sendSuccess(res, payslip, 'Payslip fetched');
  } catch (error) {
    if (error.message === 'Payslip not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const updatePayslip = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const { status, payment_method, remarks } = req.body;
    const payslip = await payrollService.updatePayslipStatus(
      req.params.id,
      instituteId,
      { status, payment_method, remarks },
      req.user.id
    );
    return sendSuccess(res, payslip, 'Payslip updated');
  } catch (error) {
    if (error.message === 'Payslip not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const deletePayslip = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) return sendBadRequest(res, 'Institute ID not found');
    const result = await payrollService.deletePayslip(req.params.id, instituteId);
    return sendSuccess(res, null, result.message);
  } catch (error) {
    if (error.message === 'Payslip not found') return sendNotFound(res, error.message);
    return sendError(res, error.message);
  }
};

export const getPayrollYears = async (req, res) => {
  try {
    const instituteId = getInstituteId(req);
    if (!instituteId) {
      return sendBadRequest(res, 'Institute ID not found');
    }

    const branchId = getBranchId(req);
    const where = { institute_id: instituteId };
    if (branchId) {
      where.branch_id = branchId;
    }

    const years = await Payslip.findAll({
      where,
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('year')), 'year']],
      order: [[sequelize.col('year'), 'DESC']],
      raw: true,
    });

    const yearList = years.map(y => y.year);
    return sendSuccess(res, yearList, 'Years fetched');
  } catch (error) {
    console.error('Error fetching payroll years:', error);
    return sendError(res, error.message);
  }
};