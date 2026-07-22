/**
 * The Clouds Academy - Report Service
 * 
 * Generate different types of reports:
 * - Student report
 * - Attendance report
 * - Fee report
 * - Exam report
 * - Payroll report
 * - Analytics dashboard
 */

import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import models from '../models/postgres/index.js';

const {
  User,
  Class,
  Section,
  StudentAttendance,
  FeeVoucher,
  ExamResult,
  Exam,
  AcademicYear,
  Institute,
  Payslip,
  FeePayment,
  Expense,
  sequelize
} = models;

// ==================== REPORT HELPERS ====================

/**
 * Format student info for reports
 */
const formatStudentInfo = (student) => {
  const details = student?.details?.studentDetails || {};
  return {
    id: student.id,
    name: `${student.first_name} ${student.last_name}`,
    student_name: `${student.first_name} ${student.last_name}`,
    registration_no: student.registration_no,
    roll_number: details.roll_no || 'N/A',
    email: student.email,
    phone: student.phone,
    class_name: details.class_name || 'N/A',
    section_name: details.section_name || 'N/A',
    father_name: details.father_name || 'N/A',
    father_phone: details.father_phone || 'N/A',
    dob: details.date_of_birth || details.dob || 'N/A',
    gender: details.gender || 'N/A',
    guardian_name: details.guardian_name || 'N/A',
  };
};

/**
 * Format date for reports
 */
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Format currency for reports
 */
const formatCurrency = (amount) => {
  return Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// ==================== STUDENT REPORT ====================

/**
 * Generate student report with details
 */
export const generateStudentReport = async (filters) => {
  try {
    const query = {
      where: {
        user_type: 'STUDENT',
        school_id: filters.institute_id
      },
      attributes: [
        'id', 'first_name', 'last_name', 'email', 'phone',
        'registration_no', 'details', 'created_at', 'is_active'
      ],
      order: [[filters.orderBy || 'first_name', filters.orderDirection || 'ASC']],
      raw: false
    };

    // Apply filters
    if (filters.search) {
      query.where[Op.or] = [
        { first_name: { [Op.iLike]: `%${filters.search}%` } },
        { last_name: { [Op.iLike]: `%${filters.search}%` } },
        { email: { [Op.iLike]: `%${filters.search}%` } },
        { registration_no: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    // Apply JSONB filters
    if (filters.class_id) {
      query.where[Op.and] = query.where[Op.and] || [];
      query.where[Op.and].push(sequelize.literal(`(details->'studentDetails'->>'class_id' = '${filters.class_id}' OR details->'studentDetails'->>'class_id' = '${filters.class_id}'::text)`));
    }

    if (filters.section_id) {
      query.where[Op.and] = query.where[Op.and] || [];
      query.where[Op.and].push(sequelize.literal(`(details->'studentDetails'->>'section_id' = '${filters.section_id}' OR details->'studentDetails'->>'section_id' = '${filters.section_id}'::text)`));
    }

    if (filters.academic_year_id) {
      query.where[Op.and] = query.where[Op.and] || [];
      query.where[Op.and].push(sequelize.literal(`(details->'studentDetails'->>'academic_year_id' = '${filters.academic_year_id}' OR details->'studentDetails'->>'academic_year_id' = '${filters.academic_year_id}'::text)`));
    }

    if (filters.status) {
      if (filters.status === 'active') query.where.is_active = true;
      else if (filters.status === 'inactive') query.where.is_active = false;
    }

    // Get stats for summary - reflect filters (Class/Section/Year) but ignore search & status
    const statsWhere = {
      user_type: 'STUDENT',
      school_id: filters.institute_id
    };

    const andConditions = [];
    if (filters.class_id) {
      andConditions.push(sequelize.literal(`(details->'studentDetails'->>'class_id' = '${filters.class_id}' OR details->'studentDetails'->>'class_id' = '${filters.class_id}'::text)`));
    }
    if (filters.section_id) {
      andConditions.push(sequelize.literal(`(details->'studentDetails'->>'section_id' = '${filters.section_id}' OR details->'studentDetails'->>'section_id' = '${filters.section_id}'::text)`));
    }
    if (filters.academic_year_id) {
      andConditions.push(sequelize.literal(`(details->'studentDetails'->>'academic_year_id' = '${filters.academic_year_id}' OR details->'studentDetails'->>'academic_year_id' = '${filters.academic_year_id}'::text)`));
    }
    if (andConditions.length > 0) statsWhere[Op.and] = andConditions;

    // Fetch matching students for stats
    const allMatchingStudents = await User.findAll({
      where: statsWhere,
      attributes: ['id', 'is_active', 'details']
    });

    // Get current date in Pakistan Time (UTC+5) for accurate Birthday check
    const pkTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });
    const today = new Date(pkTime);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const mmdd = `${mm}-${dd}`; // "MM-DD" e.g. "05-17"

    let activeCount = 0;
    let birthdayCount = 0;
    const totalCount = allMatchingStudents.length;

    allMatchingStudents.forEach(s => {
      if (s.is_active !== false && s.is_active !== 'false' && s.is_active !== 0 && s.is_active !== null) {
        activeCount++;
      }
      const studentDetails = s.details?.studentDetails || {};
      const dob = studentDetails.dob || studentDetails.date_of_birth;
      if (dob && String(dob).includes(mmdd)) {
        birthdayCount++;
      }
    });

    const inactiveCount = totalCount - activeCount;

    // Apply pagination to the main query
    if (filters.skip) query.offset = filters.skip;
    if (filters.limit) query.limit = filters.limit;

    const students = await User.findAll(query);

    const formattedStudents = students.map(student => ({
      ...formatStudentInfo(student),
      is_active: student.is_active,
      joined_on: formatDate(student.created_at)
    }));

    return {
      type: 'student_report',
      summary: {
        total_records: totalCount,
        active_students: activeCount,
        inactive_students: inactiveCount,
        birthdays_today: birthdayCount
      },
      total_records: totalCount,
      records: formattedStudents,
      timestamp: new Date(),
      filters: {
        class_id: filters.class_id,
        section_id: filters.section_id,
        academic_year_id: filters.academic_year_id,
        search: filters.search
      }
    };
  } catch (error) {
    throw new Error(`Failed to generate student report: ${error.message}`);
  }
};

// ==================== ATTENDANCE REPORT ====================

/**
 * Generate attendance report
 */
export const generateAttendanceReport = async (filters) => {
  try {
    const query = {
      where: {
        school_id: filters.institute_id
      },
      include: [
        {
          model: User,
          as: 'Student',
          attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details'],
          where: {}
        }
      ],
      order: [['date', 'DESC']],
      raw: false
    };

    // Date range filter
    if (filters.from_date && filters.to_date) {
      query.where.date = {
        [Op.between]: [new Date(filters.from_date), new Date(filters.to_date)]
      };
    }

    if (filters.student_id) {
      query.where.student_id = filters.student_id;
    }

    if (filters.class_id) {
      query.include[0].where.class_id = filters.class_id;
    }

    // Get records
    const records = await StudentAttendance.findAll(query);

    // Aggregate by type if needed
    let aggregated = records;
    if (filters.type === 'summary') {
      aggregated = records.reduce((acc, record) => {
        const date = formatDate(record.date);
        const existing = acc.find(r => r.date === date);
        if (existing) {
          existing.total += 1;
          existing[record.status] = (existing[record.status] || 0) + 1;
        } else {
          acc.push({
            date,
            total: 1,
            [record.status]: 1
          });
        }
        return acc;
      }, []);
    }

    const totalRecords = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const leaveCount = records.filter(r => r.status === 'leave').length;

    return {
      type: 'attendance_report',
      summary: {
        total_records: totalRecords,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        present_percentage: totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : 0
      },
      records: aggregated || records.map(r => ({
        date: formatDate(r.date),
        student: formatStudentInfo(r.Student),
        status: r.status,
        marked_by: r.marked_by,
        remarks: r.remarks
      })),
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate attendance report: ${error.message}`);
  }
};

// ==================== FEE REPORT ====================

/**
 * Generate fee collection/outstanding report with comprehensive filtering
 * Filters: institute_id, class_id, section_id, student_id, status, month, year, search, date range
 * Calculates: Status-wise summary, month-wise breakdown, totals
 */
export const generateFeeReport = async (filters) => {
  try {
    const query = {
      where: {
        institute_id: filters.institute_id,
        archived: false
      },
      include: [
        {
          model: User,
          as: 'Student',
          attributes: ['id', 'first_name', 'last_name', 'registration_no', 'email', 'phone', 'details'],
          where: {}
        }
      ],
      order: [['issued_date', 'DESC']],
      raw: false
    };

    // Search by student name
    if (filters.search) {
      query.include[0].where[Op.or] = [
        sequelize.where(sequelize.col('Student.first_name'), Op.iLike, `%${filters.search}%`),
        sequelize.where(sequelize.col('Student.last_name'), Op.iLike, `%${filters.search}%`),
        sequelize.where(sequelize.col('Student.registration_no'), Op.iLike, `%${filters.search}%`)
      ];
    }

    // Filter by status (pending, paid, partial, overdue, cancelled)
    if (filters.status) {
      query.where.status = filters.status;
    }

    // Filter by specific student
    if (filters.student_id) {
      query.where.student_id = filters.student_id;
    }

    // Filter by academic year
    if (filters.academic_year_id) {
      query.where.academic_year_id = filters.academic_year_id;
    }

    // Filter by month
    if (filters.month) {
      query.where.month = parseInt(filters.month);
    }

    // Filter by year
    if (filters.year) {
      query.where.year = parseInt(filters.year);
    }

    // Date range filter
    if (filters.from_date && filters.to_date) {
      query.where.issued_date = {
        [Op.between]: [new Date(filters.from_date), new Date(filters.to_date)]
      };
    } else if (filters.from_date) {
      query.where.issued_date = { [Op.gte]: new Date(filters.from_date) };
    } else if (filters.to_date) {
      query.where.issued_date = { [Op.lte]: new Date(filters.to_date) };
    }

    // Get total count before pagination
    const totalCount = await FeeVoucher.count({
      where: query.where,
      include: query.include.map(inc => ({ ...inc, attributes: undefined }))
    });

    // Apply pagination
    const skip = filters.skip || 0;
    const limit = filters.limit || 50;
    query.offset = skip;
    query.limit = limit;

    // Fetch vouchers
    const vouchers = await FeeVoucher.findAll(query);

    // For class/section filtering, do application-level filtering
    let filteredVouchers = vouchers;
    if (filters.class_id || filters.section_id) {
      filteredVouchers = vouchers.filter(v => {
        const details = v.Student?.details?.studentDetails || {};
        const classMatch = !filters.class_id || details.class_id === filters.class_id;
        const sectionMatch = !filters.section_id || details.section_id === filters.section_id;
        return classMatch && sectionMatch;
      });
    }

    // Format vouchers
    const formattedVouchers = filteredVouchers.map(v => ({
      id: v.id,
      voucher_number: v.voucher_number,
      month: v.month,
      year: v.year,
      issued_date: formatDate(v.issued_date),
      due_date: formatDate(v.due_date),
      amount: formatCurrency(v.amount),
      amount_raw: parseFloat(v.amount),
      discount: formatCurrency(v.discount),
      discount_raw: parseFloat(v.discount),
      fine: formatCurrency(v.fine),
      fine_raw: parseFloat(v.fine),
      net_amount: formatCurrency(v.net_amount),
      net_amount_raw: parseFloat(v.net_amount),
      status: v.status,
      fee_breakdown: v.fee_breakdown,
      notes: v.notes,
      archived: v.archived,
      created_by: v.created_by,
      created_at: v.createdAt ? formatDate(v.createdAt) : null,
      updated_at: v.updatedAt ? formatDate(v.updatedAt) : null,
      student: v.Student ? formatStudentInfo(v.Student) : null
    }));

    // Calculate detailed summary statistics
    const totalAmount = filteredVouchers.reduce((sum, v) => sum + parseFloat(v.amount || 0), 0);
    const totalDiscount = filteredVouchers.reduce((sum, v) => sum + parseFloat(v.discount || 0), 0);
    const totalFine = filteredVouchers.reduce((sum, v) => sum + parseFloat(v.fine || 0), 0);
    const totalNetAmount = filteredVouchers.reduce((sum, v) => sum + parseFloat(v.net_amount || 0), 0);

    // Status-wise breakdown
    const statusBreakdown = {
      pending: filteredVouchers.filter(v => v.status === 'pending').length,
      paid: filteredVouchers.filter(v => v.status === 'paid').length,
      partial: filteredVouchers.filter(v => v.status === 'partial').length,
      overdue: filteredVouchers.filter(v => v.status === 'overdue').length,
      cancelled: filteredVouchers.filter(v => v.status === 'cancelled').length
    };

    // Month-wise breakdown
    const monthWiseBreakdown = {};
    filteredVouchers.forEach(v => {
      const key = `${v.year}-${String(v.month).padStart(2, '0')}`;
      if (!monthWiseBreakdown[key]) {
        monthWiseBreakdown[key] = {
          total: 0,
          count: 0,
          statuses: { pending: 0, paid: 0, partial: 0, overdue: 0 }
        };
      }
      monthWiseBreakdown[key].total += parseFloat(v.amount || 0);
      monthWiseBreakdown[key].count += 1;
      monthWiseBreakdown[key].statuses[v.status] = (monthWiseBreakdown[key].statuses[v.status] || 0) + 1;
    });

    return {
      type: 'fee_report',
      summary: {
        total_records: filteredVouchers.length,
        total_amount: formatCurrency(totalAmount),
        total_amount_raw: totalAmount,
        total_discount: formatCurrency(totalDiscount),
        total_discount_raw: totalDiscount,
        total_fine: formatCurrency(totalFine),
        total_fine_raw: totalFine,
        total_net_amount: formatCurrency(totalNetAmount),
        total_net_amount_raw: totalNetAmount,
        status_breakdown: statusBreakdown,
        status_breakdown_formatted: {
          pending: `${statusBreakdown.pending} (${formatCurrency(filteredVouchers.filter(v => v.status === 'pending').reduce((s, v) => s + parseFloat(v.amount), 0))})`,
          paid: `${statusBreakdown.paid} (${formatCurrency(filteredVouchers.filter(v => v.status === 'paid').reduce((s, v) => s + parseFloat(v.amount), 0))})`,
          partial: `${statusBreakdown.partial} (${formatCurrency(filteredVouchers.filter(v => v.status === 'partial').reduce((s, v) => s + parseFloat(v.amount), 0))})`,
          overdue: `${statusBreakdown.overdue} (${formatCurrency(filteredVouchers.filter(v => v.status === 'overdue').reduce((s, v) => s + parseFloat(v.amount), 0))})`,
          cancelled: `${statusBreakdown.cancelled} (${formatCurrency(filteredVouchers.filter(v => v.status === 'cancelled').reduce((s, v) => s + parseFloat(v.amount), 0))})`
        },
        month_wise_breakdown: monthWiseBreakdown
      },
      records: formattedVouchers,
      pagination: {
        total: totalCount,
        skip,
        limit,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(totalCount / limit)
      },
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate fee report: ${error.message}`);
  }
};

// ==================== EXAM REPORT ====================

/**
 * Generate exam results report
 */
export const generateExamReport = async (filters) => {
  try {
    const query = {
      where: {
        school_id: filters.institute_id
      },
      include: [
        {
          model: User,
          as: 'Student',
          attributes: ['id', 'first_name', 'last_name', 'registration_no', 'details']
        },
        {
          model: Exam,
          attributes: ['id', 'name', 'type', 'total_marks']
        }
      ],
      order: [['marks_obtained', 'DESC']],
      raw: false
    };

    if (filters.exam_id) {
      query.where.exam_id = filters.exam_id;
    }

    if (filters.student_id) {
      query.where.student_id = filters.student_id;
    }

    const results = await ExamResult.findAll(query);

    const formattedResults = results.map(result => ({
      student: formatStudentInfo(result.Student),
      exam: result.Exam?.name || 'N/A',
      total_marks: result.Exam?.total_marks || 0,
      marks_obtained: result.marks_obtained,
      percentage: result.Exam?.total_marks ? ((result.marks_obtained / result.Exam.total_marks) * 100).toFixed(2) : 0,
      grade: result.grade,
      status: result.status,
      result_date: formatDate(result.created_at)
    }));

    // Calculate statistics
    const avgMarks = results.length > 0
      ? (results.reduce((sum, r) => sum + parseFloat(r.marks_obtained || 0), 0) / results.length).toFixed(2)
      : 0;

    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    return {
      type: 'exam_report',
      summary: {
        total_results: results.length,
        pass_count: passCount,
        fail_count: failCount,
        pass_percentage: results.length > 0 ? ((passCount / results.length) * 100).toFixed(2) : 0,
        average_marks: avgMarks
      },
      records: formattedResults,
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate exam report: ${error.message}`);
  }
};

// ==================== PAYROLL REPORT ====================

/**
 * Generate payroll report (staff salary)
 */
export const generatePayrollReport = async (filters) => {
  try {
    const query = {
      where: {
        institute_id: filters.institute_id
      },
      include: [
        {
          model: User,
          as: 'staff',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'details'],
          where: {}
        }
      ],
      order: [['year', 'DESC'], ['month', 'DESC']],
      raw: false
    };

    // Filter by month
    if (filters.month) {
      query.where.month = parseInt(filters.month);
    }

    // Filter by year
    if (filters.year) {
      query.where.year = parseInt(filters.year);
    }

    // Filter by status
    if (filters.status) {
      query.where.status = filters.status;
    }

    // Search by staff name
    if (filters.search) {
      query.include[0].where[Op.or] = [
        { first_name: { [Op.iLike]: `%${filters.search}%` } },
        { last_name: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    const payslips = await Payslip.findAll(query);

    const formattedRecords = payslips.map(p => ({
      id: p.id,
      month: p.month,
      year: p.year,
      staff_name: p.staff ? `${p.staff.first_name} ${p.staff.last_name}` : 'N/A',
      basic_salary: formatCurrency(p.basic_salary),
      total_allowances: formatCurrency(p.total_allowances),
      total_deductions: formatCurrency(p.total_deductions),
      net_salary: formatCurrency(p.net_salary),
      net_salary_raw: parseFloat(p.net_salary),
      status: p.status,
      paid_on: p.paid_on ? formatDate(p.paid_on) : 'N/A',
      payment_method: p.payment_method || 'N/A'
    }));

    const totalPayroll = payslips.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
    const paidCount = payslips.filter(p => p.status === 'paid').length;
    const pendingCount = payslips.filter(p => p.status === 'pending').length;

    return {
      type: 'payroll_report',
      summary: {
        total_staff: new Set(payslips.map(p => p.staff_id)).size,
        total_records: payslips.length,
        total_payroll: formatCurrency(totalPayroll),
        processed: paidCount,
        pending: pendingCount
      },
      records: formattedRecords,
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate payroll report: ${error.message}`);
  }
};

// ==================== PROFIT LOSS REPORT ====================

/**
 * Generate Profit & Loss report (Income, Expenses, Payroll)
 */
export const generateProfitLossReport = async (filters) => {
  try {
    const instituteId = filters.institute_id;
    const dateQuery = {};

    if (filters.from_date && filters.to_date) {
      dateQuery[Op.between] = [new Date(filters.from_date), new Date(filters.to_date)];
    } else if (filters.from_date) {
      dateQuery[Op.gte] = new Date(filters.from_date);
    } else if (filters.to_date) {
      dateQuery[Op.lte] = new Date(filters.to_date);
    }

    // 1. Income (Fee Payments)
    const paymentWhere = { school_id: instituteId };
    if (Object.keys(dateQuery).length > 0) paymentWhere.payment_date = dateQuery;

    const payments = await FeePayment.findAll({
      where: paymentWhere,
      attributes: ['payment_date', 'amount_paid'],
      raw: true
    });

    // 2. Expenses
    const expenseWhere = { institute_id: instituteId, status: 'approved' };
    if (Object.keys(dateQuery).length > 0) expenseWhere.date = dateQuery;

    const expenses = await Expense.findAll({
      where: expenseWhere,
      attributes: ['date', 'amount'],
      raw: true
    });

    // 3. Payroll (Payslips where status = paid)
    const payrollWhere = { institute_id: instituteId, status: 'paid' };
    if (Object.keys(dateQuery).length > 0) payrollWhere.paid_on = dateQuery;

    const payslips = await Payslip.findAll({
      where: payrollWhere,
      attributes: ['paid_on', 'net_salary'],
      raw: true
    });

    // Calculate Totals
    const totalIncome = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalPayroll = payslips.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
    
    const grossProfit = totalIncome - totalExpense;
    const netProfit = grossProfit - totalPayroll;

    // Group by Month-Year (e.g. "2026-05") for trend charts
    const monthlyData = {};

    const addToMonth = (dateObj, type, amount) => {
      if (!dateObj) return;
      const d = new Date(dateObj);
      if (isNaN(d.getTime())) return;
      
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, income: 0, expense: 0, payroll: 0 };
      }
      monthlyData[key][type] += parseFloat(amount || 0);
    };

    payments.forEach(p => addToMonth(p.payment_date, 'income', p.amount_paid));
    expenses.forEach(e => addToMonth(e.date, 'expense', e.amount));
    payslips.forEach(p => addToMonth(p.paid_on, 'payroll', p.net_salary));

    // Convert to sorted array
    const monthlyTrends = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    return {
      type: 'profit_loss_report',
      summary: {
        total_income: formatCurrency(totalIncome),
        total_income_raw: totalIncome,
        total_expense: formatCurrency(totalExpense),
        total_expense_raw: totalExpense,
        total_payroll: formatCurrency(totalPayroll),
        total_payroll_raw: totalPayroll,
        gross_profit: formatCurrency(grossProfit),
        gross_profit_raw: grossProfit,
        net_profit: formatCurrency(netProfit),
        net_profit_raw: netProfit,
        is_profitable: netProfit >= 0
      },
      monthly_trends: monthlyTrends,
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate profit/loss report: ${error.message}`);
  }
};

// ==================== ANALYTICS REPORT ====================

/**
 * Generate analytics/dashboard report
 */
export const generateAnalyticsReport = async (filters) => {
  try {
    const instituteId = filters.institute_id;

    // Get student count
    const studentCount = await User.count({
      where: {
        user_type: 'STUDENT',
        school_id: instituteId
      }
    });

    // Get attendance summary
    const presentCount = await StudentAttendance.count({
      where: {
        school_id: instituteId,
        status: 'present'
      }
    });

    const totalAttendance = await StudentAttendance.count({
      where: {
        school_id: instituteId
      }
    });

    // Get fee summary
    const totalFeeAmount = await sequelize.query(`
      SELECT SUM(amount) as total FROM "Fees" WHERE school_id = $1
    `, {
      bind: [instituteId],
      type: sequelize.QueryTypes.SELECT
    });

    const totalFeePaid = await sequelize.query(`
      SELECT SUM(paid_amount) as total FROM "Fees" WHERE school_id = $1
    `, {
      bind: [instituteId],
      type: sequelize.QueryTypes.SELECT
    });

    return {
      type: 'analytics_report',
      metrics: {
        total_students: studentCount,
        attendance_rate: totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(2) : 0,
        total_fee: formatCurrency(totalFeeAmount[0]?.total || 0),
        fee_collected: formatCurrency(totalFeePaid[0]?.total || 0),
        fee_collection_rate: totalFeeAmount[0]?.total > 0
          ? ((totalFeePaid[0]?.total / totalFeeAmount[0]?.total) * 100).toFixed(2)
          : 0
      },
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate analytics report: ${error.message}`);
  }
};

// ==================== EXPORT REPORT ====================

/**
 * Export report as PDF or Excel
 */
export const exportReport = async (data) => {
  try {
    const { report_type, format, filters } = data;

    // Generate the report based on type
    let report;
    switch (report_type) {
      case 'student':
        report = await generateStudentReport(filters);
        break;
      case 'attendance':
        report = await generateAttendanceReport(filters);
        break;
      case 'fee':
        report = await generateFeeReport(filters);
        break;
      case 'exam':
        report = await generateExamReport(filters);
        break;
      case 'payroll':
        report = await generatePayrollReport(filters);
        break;
      default:
        throw new Error(`Unknown report type: ${report_type}`);
    }

    // Export based on format
    if (format === 'pdf') {
      // TODO: Implement PDF export using a library like pdfkit or puppeteer
      return {
        buffer: Buffer.from('PDF export coming soon'),
        mimeType: 'application/pdf',
        filename: `${report_type}_report_${new Date().getTime()}.pdf`
      };
    } else if (format === 'excel') {
      // TODO: Implement Excel export using a library like xlsx
      return {
        buffer: Buffer.from('Excel export coming soon'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${report_type}_report_${new Date().getTime()}.xlsx`
      };
    }

    throw new Error('Invalid export format');
  } catch (error) {
    throw new Error(`Failed to export report: ${error.message}`);
  }
};

// ==================== TEMPLATES & OPTIONS ====================

/**
 * Get available report templates
 */
export const getReportTemplates = async () => {
  return [
    {
      id: 'student',
      name: 'Student Report',
      description: 'List of all students with contact details',
      permission: 'reports.student'
    },
    {
      id: 'attendance',
      name: 'Attendance Report',
      description: 'Attendance by class, section, or date',
      permission: 'reports.attendance'
    },
    {
      id: 'fee',
      name: 'Fee Report',
      description: 'Fee collection, outstanding, and payment status',
      permission: 'reports.fee'
    },
    {
      id: 'exam',
      name: 'Exam Report',
      description: 'Exam results by class, section, or subject',
      permission: 'reports.exam'
    },
    {
      id: 'payroll',
      name: 'Payroll Report',
      description: 'Staff salary disbursement report',
      permission: 'reports.payroll'
    },
    {
      id: 'analytics',
      name: 'Analytics Report',
      description: 'Overall metrics and KPIs',
      permission: 'reports.analytics'
    }
  ];
};

/**
 * Get filter options for reports
 */
export const getReportOptions = async (instituteId) => {
  try {
    const classes = await Class.findAll({
      where: { school_id: instituteId },
      attributes: ['id', 'name'],
      raw: true
    });

    const academicYears = await AcademicYear.findAll({
      where: { school_id: instituteId },
      attributes: ['id', 'name'],
      raw: true
    });

    return {
      classes,
      academic_years: academicYears,
      statuses: ['active', 'inactive', 'graduated'],
      fee_statuses: ['paid', 'unpaid', 'partial', 'overdue'],
      exam_statuses: ['pass', 'fail', 'absent']
    };
  } catch (error) {
    throw new Error(`Failed to get report options: ${error.message}`);
  }
};

/**
 * Get available reports based on user permissions
 */
export const getUserReportPermissions = async (user) => {
  // Get user permissions from middleware/auth
  // This is a placeholder - actual implementation depends on your permission system

  const allReports = [
    'reports.student',
    'reports.attendance',
    'reports.fee',
    'reports.exam',
    'reports.payroll',
    'reports.analytics'
  ];

  return {
    user_type: user.user_type,
    available_reports: allReports
  };
};

// ==================== CUSTOM REPORTS ====================

/**
 * Get saved custom reports
 */
export const getCustomReports = async (filters) => {
  // TODO: Implement custom reports table/model if needed
  return [];
};

/**
 * Save a custom report
 */
export const createCustomReport = async (data) => {
  // TODO: Implement saving custom report
  return {
    id: uuidv4(),
    name: data.name,
    created_at: new Date()
  };
};
