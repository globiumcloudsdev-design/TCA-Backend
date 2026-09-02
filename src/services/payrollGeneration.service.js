import crypto from 'crypto';
import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import logger from '../config/logger.js';
import * as notificationService from './notification.service.js';

const { User, StaffAttendance, Payslip, Institute, Policy, sequelize } = models;

// ─────────────────────────────────────────────────────────────
// Helper: Get active payroll policy config
// ─────────────────────────────────────────────────────────────
async function getPayrollPolicy(instituteId) {
  const payrollPolicy = await Policy.findOne({
    where: {
      institute_id: instituteId,
      policy_type: 'payroll',
      is_active: true,
    },
    attributes: ['id', 'config', 'policy_name'],
  });

  if (!payrollPolicy || !payrollPolicy.config) {
    return {
      working_days_per_month: 26,
      late_deduction_rate: 0,
      tax_brackets: [],
      allowances: [],
    };
  }
  return payrollPolicy.config;
}

// ─────────────────────────────────────────────────────────────
// Helper: Create payroll notification for staff
// ─────────────────────────────────────────────────────────────
async function sendPayrollNotification(staff, instituteId, salaryData, month, year) {
  try {
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month];
    
    const notificationData = {
      month,
      year,
      basicSalary: salaryData.basicSalary,
      totalAllowances: salaryData.totalAllowances,
      totalDeductions: salaryData.totalDeductions,
      netSalary: salaryData.netSalary,
    };

    await notificationService.createNotification(
      {
        institute_id: instituteId,
        branch_id: staff.branch_id || null,
        user_id: staff.id,
        title: `🎉 Payroll Generated - ${monthName} ${year}`,
        body: `Your payslip for ${monthName} ${year} has been generated. Net Salary: PKR ${salaryData.netSalary.toLocaleString('en-PK')}`,
        type: 'payroll',
        channel: 'in_app',
        data: notificationData,
      },
      true // emitRealtime
    );

    logger.info(`📬 Payroll notification sent to ${staff.first_name} ${staff.last_name}`);
  } catch (error) {
    logger.warn(`⚠️ Failed to send payroll notification to ${staff.id}: ${error.message}`);
    // Don't throw - notifications shouldn't block payroll generation
  }
}

// ─────────────────────────────────────────────────────────────
// Calculate attendance deductions & overtime
// ─────────────────────────────────────────────────────────────
async function calculateAttendanceDeductions(staffId, year, month, policyConfig) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const attendances = await StaffAttendance.findAll({
    where: {
      staff_id: staffId,
      date: { [Op.between]: [startDate, endDate] },
    },
    attributes: ['status', 'late_minutes', 'overtime_minutes'],
  });

  let lateCount = 0;
  let absentDays = 0;
  let halfDays = 0;
  let totalOvertimeMinutes = 0;

  for (const att of attendances) {
    if (att.status === 'LATE') lateCount++;
    else if (att.status === 'ABSENT') absentDays++;
    else if (att.status === 'HALF_DAY') halfDays++;
    totalOvertimeMinutes += att.overtime_minutes || 0;
  }

  const rules = policyConfig.attendance_rules || {};
  let totalDeductionDays = 0;

  if (rules.late_arrival?.enabled) {
    const threshold = rules.late_arrival.threshold_count || 3;
    const deductionPerThreshold = rules.late_arrival.deduction_value || 1;
    totalDeductionDays += Math.floor(lateCount / threshold) * deductionPerThreshold;
  }
  if (rules.full_day_absent?.enabled) {
    totalDeductionDays += absentDays * (rules.full_day_absent.deduction_value || 1);
  }
  if (rules.half_day_absent?.enabled) {
    totalDeductionDays += halfDays * (rules.half_day_absent.deduction_value || 0.5);
  }

  return { deductionDays: totalDeductionDays, overtimeMinutes: totalOvertimeMinutes };
}

// ─────────────────────────────────────────────────────────────
// Calculate individual staff salary for a given month
// ─────────────────────────────────────────────────────────────
async function calculateStaffSalary(staff, year, month, policyConfig) {
  // Try finding salary from details OR teacherDetails
  let basicSalary = staff.details?.salary || staff.details?.teacherDetails?.salary || 50000;
  
  // ⚠️ CRITICAL: Ensure basicSalary is a number, not a string
  basicSalary = parseFloat(basicSalary) || 50000;

  logger.debug(`💰 Calculating salary for ${staff.first_name} ${staff.last_name}: basicSalary=${basicSalary} (type: ${typeof basicSalary})`);

  const { deductionDays, overtimeMinutes } = await calculateAttendanceDeductions(
    staff.id, year, month, policyConfig
  );

  const dailyRate = basicSalary / 30;
  const attendanceDeduction = deductionDays * dailyRate;

  let overtimeAmount = 0;
  if (policyConfig.overtime?.enabled) {
    const hourlyRate = policyConfig.overtime.rate_per_hour || 200;
    const multiplier = policyConfig.overtime.multiplier || 1.5;
    overtimeAmount = (overtimeMinutes / 60) * hourlyRate * multiplier;
  }

  const salaryCalc = policyConfig.salary_calculation || {};
  let totalAllowances = 0;
  const allowancesBreakdown = [];

  if (salaryCalc.allowances) {
    for (const allowance of salaryCalc.allowances) {
      // ⚠️ CRITICAL: Ensure percentage is a valid number and not excessively large
      let percentage = parseFloat(allowance.percentage) || 0;
      
      // Sanity check: percentage should be between 0 and 1000 (0% to 1000%)
      if (percentage < 0 || percentage > 1000) {
        logger.warn(`⚠️ INVALID ALLOWANCE PERCENTAGE for "${allowance.name}": ${percentage}%. Clamping to 0-1000 range.`);
        percentage = Math.max(0, Math.min(1000, percentage));
      }
      
      const amount = (basicSalary * percentage) / 100;
      totalAllowances += amount;
      allowancesBreakdown.push({ name: allowance.name, amount });
    }
  }

  const fixedAllowances = salaryCalc.fixed_allowances || [];
  for (const fa of fixedAllowances) {
    const amount = parseFloat(fa.amount) || 0;
    totalAllowances += amount;
    allowancesBreakdown.push({ name: fa.name, amount });
  }

  let totalDeductions = 0;
  const deductionsBreakdown = [];
  const otherDeductions = policyConfig.other_deductions || [];
  for (const ded of otherDeductions) {
    let amount = 0;
    if (ded.percentage) {
      let percentage = parseFloat(ded.percentage) || 0;
      // Sanity check: percentage should be between 0 and 1000
      if (percentage < 0 || percentage > 1000) {
        logger.warn(`⚠️ INVALID DEDUCTION PERCENTAGE for "${ded.name}": ${percentage}%. Clamping to 0-1000 range.`);
        percentage = Math.max(0, Math.min(1000, percentage));
      }
      amount = (basicSalary * percentage) / 100;
    } else {
      amount = parseFloat(ded.amount) || 0;
    }
    totalDeductions += amount;
    deductionsBreakdown.push({ name: ded.name, amount });
  }

  if (attendanceDeduction > 0) {
    totalDeductions += attendanceDeduction;
    deductionsBreakdown.push({ name: 'Attendance Deductions', amount: attendanceDeduction });
  }

  const netSalary = basicSalary + totalAllowances + overtimeAmount - totalDeductions;

  // ⚠️ CRITICAL: Validate net salary is a reasonable number
  if (!Number.isFinite(netSalary)) {
    throw new Error(`Invalid net salary calculation for ${staff.id}: ${netSalary}. Calculation: ${basicSalary} + ${totalAllowances} + ${overtimeAmount} - ${totalDeductions}`);
  }

  // Sanity check: net salary should not be more than 10x the basic salary (typical max with allowances)
  if (netSalary > basicSalary * 10) {
    logger.warn(`⚠️ WARNING: Net salary (${netSalary}) is excessively high (>10x basic salary ${basicSalary}) for staff ${staff.id}. This may indicate a policy configuration error.`);
  }

  logger.debug(`✓ Salary calculated: Basic=${basicSalary}, Allowances=${totalAllowances}, Deductions=${totalDeductions}, Overtime=${overtimeAmount}, Net=${netSalary}`);

  return {
    basicSalary,
    allowances: allowancesBreakdown,
    totalAllowances,
    deductions: deductionsBreakdown,
    totalDeductions,
    overtimeAmount,
    netSalary,
  };
}

// ─────────────────────────────────────────────────────────────
// Bulk generate payroll
// ─────────────────────────────────────────────────────────────
export async function generatePayroll(instituteId, userId, options = {}) {
  const { month, year, category, staffIds = [], branchId } = options;

  if (!month || !year) throw new Error('Month and year are required');

  const policyConfig = await getPayrollPolicy(instituteId);

  let staffList = [];
  if (staffIds && staffIds.length > 0) {
    staffList = await User.findAll({
      where: { id: { [Op.in]: staffIds }, school_id: instituteId, is_active: true },
    });
  } else if (category === 'teacher') {
    staffList = await User.findAll({
      where: { school_id: instituteId, user_type: 'TEACHER', is_active: true },
    });
  } else if (category === 'staff') {
    staffList = await User.findAll({
      where: { school_id: instituteId, user_type: 'STAFF', is_active: true },
    });
  } else {
    const staffWhere = { school_id: instituteId, user_type: { [Op.in]: ['TEACHER', 'STAFF'] }, is_active: true };
    if (branchId) {
      staffWhere.branch_id = branchId;
    }
    staffList = await User.findAll({
      where: staffWhere,
    });
  }

  const result = { total: staffList.length, generated: 0, skipped: 0, failed: 0, errors: [] };

  try {
    for (const staff of staffList) {
      const existing = await Payslip.findOne({
        where: { staff_id: staff.id, month, year },
      });
      if (existing) {
        result.skipped++;
        continue;
      }

      try {
        const salaryData = await calculateStaffSalary(staff, year, month, policyConfig);
        
        // ⚠️ CRITICAL: Ensure all numeric values are proper numbers before storing
        const payslipData = {
          id: crypto.randomUUID(),
          institute_id: instituteId,
          branch_id: staff.branch_id,
          staff_id: staff.id,
          month,
          year,
          basic_salary: Number(salaryData.basicSalary) || 0,
          allowances: salaryData.allowances,
          total_allowances: Number(salaryData.totalAllowances) || 0,
          deductions: salaryData.deductions,
          total_deductions: Number(salaryData.totalDeductions) || 0,
          overtime_amount: Number(salaryData.overtimeAmount) || 0,
          net_salary: Number(salaryData.netSalary) || 0,
          status: 'pending',
          generated_by: userId,
          generated_at: new Date(),
        };
        
        logger.info(`📝 Creating payslip for ${staff.first_name} ${staff.last_name}: net_salary=${payslipData.net_salary}`);
        
        await Payslip.create(payslipData);
        result.generated++;
        
        // Send notification to staff (outside transaction to avoid rollback)
        setImmediate(() => sendPayrollNotification(staff, instituteId, salaryData, month, year));
      } catch (err) {
        result.failed++;
        result.errors.push({ staff_id: staff.id, name: `${staff.first_name} ${staff.last_name}`, error: err.message });
        logger.error(`Payroll generation failed for ${staff.id}: ${err.message}`);
      }
    }
  } catch (err) {
    throw err;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// CRUD operations for payslips
// ─────────────────────────────────────────────────────────────
export async function getPayslips(filters, pagination) {
  const { page = 1, limit = 10, sortBy = 'generated_at', sortOrder = 'DESC' } = pagination;
  const offset = (page - 1) * limit;

  const where = { institute_id: filters.institute_id };
  if (filters.branch_id) where.branch_id = filters.branch_id;
  if (filters.staff_id) where.staff_id = filters.staff_id;
  if (filters.month) where.month = filters.month;
  if (filters.year) where.year = filters.year;
  if (filters.status) where.status = filters.status;

  const { count, rows } = await Payslip.findAndCountAll({
    where,
    include: [
      { model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name', 'user_type', 'avatar_url'] },
      { model: User, as: 'generator', attributes: ['id', 'first_name', 'last_name'] },
    ],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  return { data: rows, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } };
}

export async function getPayslipById(id, instituteId) {
  const payslip = await Payslip.findOne({
    where: { id, institute_id: instituteId },
    include: [
      { model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'avatar_url'] },
      { model: User, as: 'generator', attributes: ['id', 'first_name', 'last_name'] },
    ],
  });
  if (!payslip) throw new Error('Payslip not found');
  return payslip;
}

export async function updatePayslipStatus(id, instituteId, updateData, userId) {
  const payslip = await Payslip.findOne({ where: { id, institute_id: instituteId } });
  if (!payslip) throw new Error('Payslip not found');

  await payslip.update({
    ...updateData,
    paid_on: updateData.status === 'paid' ? new Date().toISOString().split('T')[0] : payslip.paid_on,
  });
  return getPayslipById(id, instituteId);
}

export async function deletePayslip(id, instituteId) {
  const payslip = await Payslip.findOne({ where: { id, institute_id: instituteId } });
  if (!payslip) throw new Error('Payslip not found');
  await payslip.destroy();
  return { message: 'Payslip deleted' };
}


// Add this function to payrollGeneration.service.js
export async function getDistinctYearsForStaff(staffId, instituteId) {
  const years = await Payslip.findAll({
    where: { staff_id: staffId, institute_id: instituteId },
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('year')), 'year']],
    order: [[sequelize.col('year'), 'DESC']],
    raw: true,
  });
  return years.map(y => y.year);
}