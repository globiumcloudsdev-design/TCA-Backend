/**
 * The Clouds Academy - Fee Voucher Service
 * Bulk voucher generation with concession support
 */

import FeeVoucher from '../models/postgres/FeeVoucher.model.js';
import User from '../models/postgres/User.model.js';
import Institute from '../models/postgres/Institute.model.js';
import FeeTemplate from '../models/postgres/FeeTemplate.model.js';
import Class from '../models/postgres/Class.model.js';
import Section from '../models/postgres/Section.model.js';
import { Op } from 'sequelize';
import { default as sequelize } from '../config/database.js';
import generateVoucherNumber from '../utils/fee/generateVoucherNumber.js';
import { AppError } from '../utils/lib/AppError.js';
import logger from '../config/logger.js';
import { broadcastNotification, createNotification } from './notification.service.js';
import FeePayment from '../models/postgres/FeePayment.model.js';
import { v4 as uuidv4 } from 'uuid';

const PAYMENT_METHODS = ['cash', 'cheque', 'bank_transfer', 'jazzcash', 'easypaisa', 'stripe', 'other'];
const newReceiptNumber = () => `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Run fn(transaction) inside the caller's transaction, or open (and commit/rollback) our own. */
const withTransaction = async (existing, fn) => {
  if (existing) return fn(existing);
  const t = await sequelize.transaction();
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

/**
 * Get next sequence number for voucher numbering per institute & month
 * Format: [INSTITUTE_CODE]-[YYYYMM]-[SEQ]
 * Uses database to maintain sequence atomically
 */
const getNextSequence = async (instituteCode, year, month, transaction = null) => {
  try {
    const prefix = `${instituteCode}-${year}${String(month).padStart(2, '0')}-`;
    // Serialize numbering per institute+month inside a transaction (released on commit)
    if (transaction) {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext($1))', { bind: [prefix], transaction });
    }
    // Query to get current max sequence for this institute & month
    // Format: [CODE]-[YYYYMM]-[SEQUENCE]
    // Use SPLIT_PART to extract the sequence number from the 3rd segment
    const result = await sequelize.query(`
      SELECT COALESCE(MAX(
        CAST(REGEXP_REPLACE(voucher_number, '^.*-', '') AS INTEGER)
      ), 0) + 1 as next_seq
      FROM fee_vouchers
      WHERE LEFT(voucher_number, LENGTH($1)) = $1
      AND voucher_number ~ '-[0-9]+$'
    `, {
      bind: [prefix],
      type: sequelize.QueryTypes.SELECT,
      transaction
    });

    return result[0]?.next_seq || 1;
  } catch (error) {
    console.error('Error getting next sequence:', error);
    // Fallback to timestamp-based sequence
    return Math.floor(Math.random() * 9000) + 1000;
  }
};

/**
 * Get previous balance from unpaid/partial fees
 * Includes both partial payments and completely unpaid vouchers from current year
 */
const getPreviousBalance = async (studentId, instituteId, feeType, currentYear) => {
  try {
    // Get all unpaid or partially paid vouchers for this student and fee type from current year
    const previousVouchers = await FeeVoucher.findAll({
      where: {
        student_id: studentId,
        institute_id: instituteId,
        fee_type: (feeType === 'monthly' || feeType === 'fee_template') ? { [Op.in]: ['monthly', 'fee_template'] } : feeType,
        year: currentYear,
        status: { [Op.in]: ['pending', 'partial', 'overdue'] },
        archived: false,
      },
      order: [['issued_date', 'DESC']],
    });

    if (previousVouchers.length === 0) return 0;

    // Calculate total pending: sum of unpaid portions
    let totalPending = 0;
    for (const voucher of previousVouchers) {
      // Get sum of payments for this voucher
      const payments = await sequelize.models.FeePayment.findAll({
        where: { voucher_id: voucher.id }
      });
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
      const remaining = Math.max(parseFloat(voucher.net_amount) - totalPaid, 0);
      totalPending += remaining;
    }

    return totalPending;
  } catch (error) {
    console.error('Error calculating previous balance:', error);
    return 0;
  }
};

/**
 * Check if voucher already exists for this student, month, and fee type
 */
const voucherExists = async (studentId, instituteId, month, year, feeType) => {
  const existing = await FeeVoucher.findOne({
    where: {
      student_id: studentId,
      institute_id: instituteId,
      month,
      year,
      fee_type: (feeType === 'monthly' || feeType === 'fee_template') ? { [Op.in]: ['monthly', 'fee_template'] } : feeType,
      archived: false,
    },
  });
  return existing;
};

/**
 * Get fee amount based on type and student details
 */
const getFeeAmount = (studentDetails, feeType, feeTemplate = null, customAmount = 0) => {
    if (customAmount > 0) return customAmount;
    if (feeType === 'fee_template') {
        return parseFloat(feeTemplate?.total_amount) || parseFloat(feeTemplate?.calculated_totals?.final_total) || 0;
    }
  if (feeType === 'monthly') {
    return parseFloat(studentDetails?.monthly_fee) || parseFloat(studentDetails?.monthlyFee) || 0;
  } else if (feeType === 'annual') {
    return parseFloat(studentDetails?.annual_charges) || 0;
  } else if (feeType === 'lab') {
    return parseFloat(studentDetails?.lab_charges) || 0;
  } else if (feeType === 'admission') {
    return parseFloat(studentDetails?.admission_charges) || 0;
  }
  return 0;
};

/**
 * Calculate concession amount
 */
const calculateConcession = (monthlyFee, discountType, concessionPercentage = 0, concessionAmount = 0) => {
    if (discountType === 'percentage') {
        return (monthlyFee * concessionPercentage) / 100;
    } else if (discountType === 'fixed') {
        return concessionAmount || 0;
    }
    return 0;
};

/**
 * Prepare fee breakdown with component details
 */
const prepareFeeBreakdown = (student, studentDetails, feeType, previousBalance = 0, feeTemplateId = null) => {
    return {
        fee_type: feeType,
        monthly_fee: studentDetails.monthly_fee || 0,
        annual_charges: studentDetails.annual_charges || 0,
        lab_charges: studentDetails.lab_charges || 0,
        admission_charges: studentDetails.admission_charges || 0,
        concession_type: studentDetails.concession_type || 'none',
        discount_type: studentDetails.discount_type,
        concession_percentage: studentDetails.concession_percentage || 0,
        concession_reason: studentDetails.concession_reason || 'N/A',
        student_name: `${student.first_name} ${student.last_name}`,
        registration_no: student.registration_no,
        class_id: studentDetails.class_id,
        section_id: studentDetails.section_id,
        previous_balance_status: previousBalance > 0 ? `Pending: PKR ${previousBalance.toFixed(2)}` : 'No pending balance',
        fee_template_applied: feeTemplateId ? `Template ID: ${feeTemplateId}` : 'No template'
    };
};

/**
 * Generate single fee voucher for a student
 * Supports: monthly, annual, lab fees
 */
export const generateSingleVoucher = async (studentId, instituteId, month, year, createdBy, options = {}) =>
    // Own transaction when none supplied: archiving carried-forward vouchers and
    // creating the new voucher must succeed or fail together.
    withTransaction(options.transaction, (transaction) =>
        generateSingleVoucherInner(studentId, instituteId, month, year, createdBy, { ...options, transaction })
    );

const generateSingleVoucherInner = async (
    studentId,
    instituteId,
    month,
    year,
    createdBy,
    options = {}
) => {
    let { transaction, dueDate, academicYearId, feeType = 'monthly', feeTemplateId, amount: customAmount, fee_components } = options;
    let resolvedFeeType = feeType;

    if (!customAmount && Array.isArray(fee_components) && fee_components.length > 0) {
        customAmount = fee_components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }

    // If fee template is selected, fetch it and use its fee_type
    let feeTemplate = options.feeTemplate !== undefined ? options.feeTemplate : null;
    if (feeTemplateId && !feeTemplate) {
        feeTemplate = await FeeTemplate.findOne({
            where: { id: feeTemplateId, institute_id: instituteId, is_active: true }
        });
        
        if (!feeTemplate) {
            throw new AppError('Fee template not found or is inactive', 404);
        }
    }

    if (feeTemplate) {
        // For template-based vouchers, always store fee type as fee_template.
        resolvedFeeType = 'fee_template';
    }

    // Check if voucher already exists for this student, month, and fee type
    let existingVoucher = null;
    if (options.existingVoucherSet) {
        const isMonthlyType = resolvedFeeType === 'monthly' || resolvedFeeType === 'fee_template';
        const hasExisting = options.existingVoucherSet.has(`${studentId}-${resolvedFeeType}`) ||
            (isMonthlyType && (options.existingVoucherSet.has(`${studentId}-monthly`) || options.existingVoucherSet.has(`${studentId}-fee_template`)));
        if (hasExisting) {
            throw new AppError(`Fee voucher already exists for this student for billing month ${month}/${year}. Duplicate voucher cannot be generated.`, 400);
        }
    } else {
        existingVoucher = await voucherExists(studentId, instituteId, month, year, resolvedFeeType);
        if (existingVoucher) {
            const studentRecord = options.student || (await User.findOne({
                where: { id: studentId, school_id: instituteId },
                attributes: ['first_name', 'last_name', 'registration_no'],
                transaction
            }));
            const studentName = studentRecord ? `${studentRecord.first_name || ''} ${studentRecord.last_name || ''}`.trim() : 'Student';
            const regNo = studentRecord?.registration_no ? ` (Reg: ${studentRecord.registration_no})` : '';
            const vNo = existingVoucher?.voucher_number ? ` (Voucher #${existingVoucher.voucher_number})` : '';
            throw new AppError(
                `Fee voucher already exists for ${studentName}${regNo} for billing month ${month}/${year}${vNo}. Duplicate voucher cannot be generated.`,
                400
            );
        }
    }

    // Get student with details (use preloaded student if provided in bulk mode)
    const student = options.student || (await User.findOne({
        where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' },
        transaction
    }));

    if (!student) {
        throw new AppError('Student not found', 404);
    }

    const studentDetails = student.details?.studentDetails || {};
    
    // Get fee amount based on resolved type
    let amount = getFeeAmount(studentDetails, resolvedFeeType, feeTemplate, customAmount);

    if (amount <= 0) {
        amount = 5000; // Fallback default tuition amount for newly created students
    }

    // Calculate concession
    const concessionAmount = calculateConcession(
        amount,
        studentDetails.discount_type,
        studentDetails.concession_percentage,
        studentDetails.concession_amount
    );

    // Calculate and soft-delete/archive previous unpaid vouchers to transfer outstanding balance
    let previousBalance = 0;
    let previousVouchersInfo = [];
    
    // Find all active unpaid or partially paid vouchers for this student and fee type
    const previousVouchers = await FeeVoucher.findAll({
      where: {
        student_id: studentId,
        institute_id: instituteId,
        fee_type: resolvedFeeType,
        year,
        status: { [Op.in]: ['pending', 'partial', 'overdue'] },
        archived: false,
      },
      include: [
        {
          model: FeePayment,
          as: 'payments',
          attributes: ['id', 'amount_paid']
        }
      ],
      order: [['issued_date', 'ASC']],
      transaction
    });

    for (const prevVoucher of previousVouchers) {
      // Get sum of payments for this prevVoucher
      const payments = prevVoucher.payments || [];
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
      const remaining = Math.max(parseFloat(prevVoucher.net_amount) - totalPaid, 0);
      
      if (remaining > 0) {
        previousBalance += remaining;
        previousVouchersInfo.push({
          id: prevVoucher.id,
          voucher_number: prevVoucher.voucher_number,
          remaining: remaining
        });

        // Archive/soft-delete previous voucher to avoid duplicate active billing
        await prevVoucher.update({
          archived: true,
          notes: (prevVoucher.notes || '') + `\n⚠️ [ARCHIVED] Carried forward into new voucher. Outstanding balance of PKR ${remaining.toFixed(2)} transferred.`
        }, { transaction });
      }
    }

    // Get institute code (optimized to avoid N+1 query)
    const instituteCode = options.instituteCode || (await Institute.findByPk(instituteId, { transaction }))?.institute_code || 'TCA';

    // Generate voucher number (per institute + month, serialized by advisory lock)
    const voucherNumber = options.voucherNumber || (await generateVoucherNumber(
        instituteCode,
        new Date(year, month - 1, 1),
        (code, y, m) => getNextSequence(code, y, m, transaction)
    ));

    // Prepare voucher data
    const netAmount = amount - concessionAmount + previousBalance;

    // Get details about previous unpaid fees if any
    let previousFeesInfo = '';
    if (previousVouchersInfo.length > 0) {
        const details = previousVouchersInfo
            .map(v => `#[${v.voucher_number}] (PKR ${v.remaining.toFixed(2)})`)
            .join(', ');
        previousFeesInfo = `\n⚠️ CARRIED FORWARD FROM ARCHIVED UNPAID VOUCHER(S): ${details}`;
    }

    const notes = `
Student: ${student.first_name} ${student.last_name} (${student.registration_no})
Fee Type: ${resolvedFeeType.toUpperCase()}
${feeTemplateId ? `Fee Template: Applied (ID: ${feeTemplateId})` : 'Fee Template: None'}
Current Month/Year Fee: PKR ${amount.toFixed(2)}
Concession Type: ${studentDetails.discount_type}
${studentDetails.discount_type === 'percentage'
            ? `Concession: ${studentDetails.concession_percentage}% = PKR ${concessionAmount.toFixed(2)}`
            : `Concession: PKR ${concessionAmount.toFixed(2)}`
        }
Concession Reason: ${studentDetails.concession_reason || 'N/A'}${previousFeesInfo}
${previousBalance > 0 ? `\nTotal Previous Balance: PKR ${previousBalance.toFixed(2)}` : ''}
Total Amount Due: PKR ${netAmount.toFixed(2)}
`.trim();

    // Create fee breakdown
    const feeBreakdown = prepareFeeBreakdown(student, studentDetails, resolvedFeeType, previousBalance, feeTemplateId);

    // Create voucher
    const voucher = await FeeVoucher.create(
        {
            institute_id: instituteId,
            branch_id: options.branch_id || student.branch_id || null,
            student_id: studentId,
            fee_template_id: feeTemplateId || null,
            fee_type: resolvedFeeType,
            academic_year_id: academicYearId || studentDetails.academic_year_id,
            voucher_number: voucherNumber,
            month,
            year,
            issued_date: new Date(),
            amount,
            discount: concessionAmount,
            previous_balance: previousBalance,
            net_amount: netAmount,
            currency: 'PKR',
            status: 'pending',
            due_date: dueDate || null,
            notes,
            fee_breakdown: feeBreakdown,
            created_by: createdBy
        },
        { transaction }
    );

    // Send notifications
    if (options.isBulk) {
        setImmediate(async () => {
            try {
                const notificationTitle = `💵 ${resolvedFeeType.toUpperCase()} Fee Voucher Generated`;
                const notificationBody = `Voucher #${voucher.voucher_number} for ${resolvedFeeType} fee has been generated. Amount: PKR ${netAmount.toFixed(2)}`;

                // Notify student
                await createNotification({
                    institute_id: instituteId,
                    user_id: studentId,
                    title: notificationTitle,
                    body: notificationBody,
                    type: 'fee',
                    channel: 'in_app',
                    data: {
                        voucherId: voucher.id,
                        voucherNumber: voucher.voucher_number,
                        feeType: resolvedFeeType,
                        amount: netAmount
                    }
                }, true);

                // Notify linked parents
                const parents = options.allParents || [];
                const linkedParents = parents.filter((parent) => {
                    const studentIds = parent.details?.parentDetails?.student_ids || [];
                    return Array.isArray(studentIds) && studentIds.includes(studentId);
                });

                for (const parent of linkedParents) {
                    await createNotification({
                        institute_id: instituteId,
                        user_id: parent.id,
                        title: notificationTitle,
                        body: `${student.first_name}'s ${notificationBody}`,
                        type: 'fee',
                        channel: 'in_app',
                        data: {
                            voucherId: voucher.id,
                            studentId,
                            studentName: `${student.first_name} ${student.last_name}`
                        }
                    }, true);
                }

                // Notify institute admins
                await broadcastNotification({
                    institute_id: instituteId,
                    recipient_type: 'ALL_ADMINS',
                    title: `💵 Fee Voucher Generated: ${student.first_name} ${student.last_name}`,
                    body: `${resolvedFeeType.toUpperCase()} voucher #${voucher.voucher_number} generated. Amount: PKR ${netAmount.toFixed(2)}`,
                    type: 'fee',
                    channel: 'in_app',
                    data: {
                        voucherId: voucher.id,
                        studentId,
                        studentName: `${student.first_name} ${student.last_name}`,
                        feeType: resolvedFeeType,
                        amount: netAmount,
                        voucherNumber: voucher.voucher_number
                    }
                }, true);
            } catch (error) {
                logger.error(`Failed to send bulk voucher background notification: ${error.message}`);
            }
        });
    } else {
        try {
            const notificationTitle = `💵 ${resolvedFeeType.toUpperCase()} Fee Voucher Generated`;
            const notificationBody = `Voucher #${voucher.voucher_number} for ${resolvedFeeType} fee has been generated. Amount: PKR ${netAmount.toFixed(2)}`;

            // Notify student
            await createNotification({
                institute_id: instituteId,
                user_id: studentId,
                title: notificationTitle,
                body: notificationBody,
                type: 'fee',
                channel: 'in_app',
                data: {
                    voucherId: voucher.id,
                    voucherNumber: voucher.voucher_number,
                    feeType: resolvedFeeType,
                    amount: netAmount
                }
            }, true);

            // Notify linked parents (preloaded option used if present to optimize DB)
            const { User: UserModel } = sequelize.models;
            const parents = options.allParents || await UserModel.findAll({
                where: {
                    school_id: instituteId,
                    user_type: 'PARENT',
                    is_active: true
                },
                transaction
            });

            const linkedParents = parents.filter((parent) => {
                const studentIds = parent.details?.parentDetails?.student_ids || [];
                return Array.isArray(studentIds) && studentIds.includes(studentId);
            });

            for (const parent of linkedParents) {
                await createNotification({
                    institute_id: instituteId,
                    user_id: parent.id,
                    title: notificationTitle,
                    body: `${student.first_name}'s ${notificationBody}`,
                    type: 'fee',
                    channel: 'in_app',
                    data: {
                        voucherId: voucher.id,
                        studentId,
                        studentName: `${student.first_name} ${student.last_name}`
                    }
                }, true);
            }

            // Notify institute admins (matching attendance notification pattern)
            await broadcastNotification({
                institute_id: instituteId,
                recipient_type: 'ALL_ADMINS',
                title: `💵 Fee Voucher Generated: ${student.first_name} ${student.last_name}`,
                body: `${resolvedFeeType.toUpperCase()} voucher #${voucher.voucher_number} generated. Amount: PKR ${netAmount.toFixed(2)}`,
                type: 'fee',
                channel: 'in_app',
                data: {
                    voucherId: voucher.id,
                    studentId,
                    studentName: `${student.first_name} ${student.last_name}`,
                    feeType: resolvedFeeType,
                    amount: netAmount,
                    voucherNumber: voucher.voucher_number
                }
            }, true);

        } catch (error) {
            logger.error(`Failed to send voucher notification: ${error.message}`);
        }
    }

    return voucher;
};

/**
 * Generate vouchers for all students in a class (for multiple fee types)
 */
export const generateVouchersForClass = async (
    classId,
    instituteId,
    month,
    year,
    createdBy,
    options = {}
) => {
    const { transaction, dueDate, academicYearId, feeType = 'monthly', feeTemplateId, feeTypes } = options;
    
    // Use feeType (singular) or feeTypes (plural/array) - support both for backward compatibility
    const feesToGenerate = Array.isArray(feeTypes) ? feeTypes : [feeType];

    // Preload institute code & all parents once to completely optimize N+1 queries
    const institute = await Institute.findByPk(instituteId, { transaction });
    const instituteCode = institute?.institute_code || 'TCA';

    const { User: UserModel } = sequelize.models;
    const allParents = await UserModel.findAll({
        where: {
            school_id: instituteId,
            user_type: 'PARENT',
            is_active: true
        },
        transaction
    });

    // Get all active students in this class
    const studentWhere = {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true
    };
    if (options.branch_id) {
        studentWhere.branch_id = options.branch_id;
    }

    const students = await User.findAll({
        where: studentWhere,
        transaction
    });

    // Filter students by class_id from details
    const classStudents = students.filter(
        s => s.details?.studentDetails?.class_id === classId ||
            String(s.details?.studentDetails?.class_id) === String(classId)
    );

    if (classStudents.length === 0) {
        throw new AppError('No students found in this class', 404);
    }

    // Preload fee template once
    let feeTemplate = null;
    if (feeTemplateId) {
        feeTemplate = await FeeTemplate.findOne({
            where: { id: feeTemplateId, institute_id: instituteId, is_active: true }
        });
        if (!feeTemplate) {
            throw new AppError('Fee template not found or is inactive', 404);
        }
    }

    // Preload existing vouchers for this month/year for class students to eliminate N+1 checks
    const existingVouchers = await FeeVoucher.findAll({
        where: {
            institute_id: instituteId,
            month,
            year,
            student_id: { [Op.in]: classStudents.map(s => s.id) },
            archived: false
        },
        attributes: ['student_id', 'fee_type'],
        transaction
    });
    const existingVoucherSet = new Set();
    existingVouchers.forEach(v => {
        existingVoucherSet.add(`${v.student_id}-${v.fee_type}`);
        if (v.fee_type === 'monthly' || v.fee_type === 'fee_template') {
            existingVoucherSet.add(`${v.student_id}-monthly`);
            existingVoucherSet.add(`${v.student_id}-fee_template`);
        }
    });

    // Fetch starting sequence number once
    let currentSeq = await getNextSequence(instituteCode, year, month);

    const vouchers = [];
    const skipped = [];
    const failed = [];

    for (const student of classStudents) {
        for (const feeTypeItem of feesToGenerate) {
            try {
                const targetFeeType = feeTemplate ? 'fee_template' : feeTypeItem;
                const seqStr = String(currentSeq++).padStart(4, '0');
                const voucherNumber = `${instituteCode}-${year}${String(month).padStart(2, '0')}-${seqStr}`;

                const voucher = await generateSingleVoucher(
                    student.id,
                    instituteId,
                    month,
                    year,
                    createdBy,
                    { 
                        transaction, 
                        dueDate, 
                        academicYearId, 
                        feeType: feeTypeItem, 
                        feeTemplateId,
                        feeTemplate,
                        existingVoucherSet,
                        voucherNumber,
                        student,
                        instituteCode,
                        allParents,
                        branch_id: options.branch_id || student.branch_id,
                        isBulk: true
                    }
                );
                vouchers.push(voucher);
                existingVoucherSet.add(`${student.id}-${targetFeeType}`);
            } catch (error) {
                if (error.message && error.message.includes('already exists')) {
                    skipped.push({
                        studentId: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        feeType: feeTypeItem,
                        reason: error.message
                    });
                } else {
                    console.error(`Failed to generate ${feeTypeItem} voucher for student ${student.id}:`, error);
                    failed.push({
                        studentId: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        feeType: feeTypeItem,
                        error: error.message
                    });
                }
            }
        }
    }

    return {
        total: classStudents.length * feesToGenerate.length,
        generated: vouchers.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        failed: failed.length,
        failedDetails: failed,
        vouchers
    };
};

/**
 * Generate vouchers for entire institute (for multiple fee types)
 */
export const generateVouchersForInstitute = async (
    instituteId,
    month,
    year,
    createdBy,
    options = {}
) => {
    const { transaction, dueDate, academicYearId, feeType = 'monthly', feeTemplateId, feeTypes } = options;
    
    // Use feeType (singular) or feeTypes (plural/array) - support both for backward compatibility
    const feesToGenerate = Array.isArray(feeTypes) ? feeTypes : [feeType];

    // Preload institute code & all parents once to completely optimize N+1 queries
    const institute = await Institute.findByPk(instituteId, { transaction });
    const instituteCode = institute?.code || 'TCA';

    const { User: UserModel } = sequelize.models;
    const allParents = await UserModel.findAll({
        where: {
            school_id: instituteId,
            user_type: 'PARENT',
            is_active: true
        },
        transaction
    });

    // Get all active students in institute
    const studentWhere = {
        school_id: instituteId,
        user_type: 'STUDENT',
        is_active: true
    };
    if (options.branch_id) {
        studentWhere.branch_id = options.branch_id;
    }

    const students = await User.findAll({
        where: studentWhere,
        transaction
    });

    if (students.length === 0) {
        throw new AppError('No students found in this institute', 404);
    }

    // Preload fee template once
    let feeTemplate = null;
    if (feeTemplateId) {
        feeTemplate = await FeeTemplate.findOne({
            where: { id: feeTemplateId, institute_id: instituteId, is_active: true }
        });
        if (!feeTemplate) {
            throw new AppError('Fee template not found or is inactive', 404);
        }
    }

    // Preload existing vouchers for this month/year for all institute students to eliminate N+1 checks
    const existingVouchers = await FeeVoucher.findAll({
        where: {
            institute_id: instituteId,
            month,
            year,
            student_id: { [Op.in]: students.map(s => s.id) },
            archived: false
        },
        attributes: ['student_id', 'fee_type'],
        transaction
    });
    const existingVoucherSet = new Set();
    existingVouchers.forEach(v => {
        existingVoucherSet.add(`${v.student_id}-${v.fee_type}`);
        if (v.fee_type === 'monthly' || v.fee_type === 'fee_template') {
            existingVoucherSet.add(`${v.student_id}-monthly`);
            existingVoucherSet.add(`${v.student_id}-fee_template`);
        }
    });

    // Fetch starting sequence number once
    let currentSeq = await getNextSequence(instituteCode, year, month);

    const vouchers = [];
    const skipped = [];
    const failed = [];

    for (const student of students) {
        for (const feeTypeItem of feesToGenerate) {
            try {
                const targetFeeType = feeTemplate ? 'fee_template' : feeTypeItem;
                const seqStr = String(currentSeq++).padStart(4, '0');
                const voucherNumber = `${instituteCode}-${year}${String(month).padStart(2, '0')}-${seqStr}`;

                const voucher = await generateSingleVoucher(
                    student.id,
                    instituteId,
                    month,
                    year,
                    createdBy,
                    { 
                        transaction, 
                        dueDate, 
                        academicYearId, 
                        feeType: feeTypeItem, 
                        feeTemplateId,
                        feeTemplate,
                        existingVoucherSet,
                        voucherNumber,
                        student,
                        instituteCode,
                        allParents,
                        isBulk: true,
                        branch_id: options.branch_id || student.branch_id
                    }
                );
                vouchers.push(voucher);
                existingVoucherSet.add(`${student.id}-${targetFeeType}`);
            } catch (error) {
                if (error.message && error.message.includes('already exists')) {
                    skipped.push({
                        studentId: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        feeType: feeTypeItem,
                        reason: error.message
                    });
                } else {
                    console.error(`Failed to generate ${feeTypeItem} voucher for student ${student.id}:`, error);
                    failed.push({
                        studentId: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        feeType: feeTypeItem,
                        error: error.message
                    });
                }
            }
        }
    }

    return {
        total: students.length * feesToGenerate.length,
        generated: vouchers.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        failed: failed.length,
        failedDetails: failed,
        vouchers
    };
};

/**
 * Get all fee vouchers for institute with filters
 */

/**
 * Helper: Resolve active class & section names as well as father names for vouchers
 */
const resolveVouchersClassAndSection = async (vouchers = []) => {
    if (!vouchers || !vouchers.length) return vouchers;

    const classIds = new Set();
    const sectionIds = new Set();

    vouchers.forEach(v => {
        const student = v.Student || {};
        const details = student.details || {};
        const studentDetails = details.studentDetails || {};
        const activeSession = details.active_session || studentDetails.active_session || (Array.isArray(details.academic_history) && details.academic_history[0]) || {};
        const breakdown = v.fee_breakdown || {};

        const cId = v.class_id || breakdown.class_id || activeSession.class_id || studentDetails.class_id || details.class_id;
        const sId = v.section_id || breakdown.section_id || activeSession.section_id || studentDetails.section_id || details.section_id;

        if (cId) classIds.add(String(cId));
        if (sId) sectionIds.add(String(sId));
    });

    const [classes, sections] = await Promise.all([
        classIds.size
            ? Class.findAll({
                where: { id: { [Op.in]: Array.from(classIds) } },
                attributes: ['id', 'name', 'sections']
            })
            : Promise.resolve([]),
        sectionIds.size
            ? Section.findAll({
                where: { id: { [Op.in]: Array.from(sectionIds) } },
                attributes: ['id', 'name']
            })
            : Promise.resolve([])
    ]);

    const classNameMap = new Map();
    const sectionNameMap = new Map();

    classes.forEach(c => {
        classNameMap.set(String(c.id), c.name);
        if (Array.isArray(c.sections)) {
            c.sections.forEach(s => {
                if (s.id && s.name) sectionNameMap.set(String(s.id), s.name);
            });
        }
    });

    sections.forEach(s => {
        sectionNameMap.set(String(s.id), s.name);
    });

    vouchers.forEach(v => {
        const student = v.Student || {};
        const details = student.details || {};
        const studentDetails = details.studentDetails || {};
        const activeSession = details.active_session || studentDetails.active_session || (Array.isArray(details.academic_history) && details.academic_history[0]) || {};
        const breakdown = v.fee_breakdown || {};

        const cId = String(v.class_id || breakdown.class_id || activeSession.class_id || studentDetails.class_id || details.class_id || '');
        const sId = String(v.section_id || breakdown.section_id || activeSession.section_id || studentDetails.section_id || details.section_id || '');

        const resolvedClassName = (cId ? classNameMap.get(cId) : null) || activeSession.class_name || studentDetails.class_name || breakdown.class_name || v.class_name || null;
        const resolvedSectionName = (sId ? sectionNameMap.get(sId) : null) || activeSession.section_name || studentDetails.section_name || breakdown.section_name || v.section_name || null;
        const fatherName = studentDetails.father_name || details.father_name || student.father_name || null;

        v.className = resolvedClassName;
        v.class_name = resolvedClassName;
        v.sectionName = resolvedSectionName;
        v.section_name = resolvedSectionName;
        v.father_name = fatherName;
        v.fatherName = fatherName;

        if (v.Student) {
            v.Student.className = resolvedClassName;
            v.Student.class_name = resolvedClassName;
            v.Student.sectionName = resolvedSectionName;
            v.Student.section_name = resolvedSectionName;
            v.Student.father_name = fatherName;
            v.Student.fatherName = fatherName;
            if (v.Student.details) {
                if (!v.Student.details.studentDetails) v.Student.details.studentDetails = {};
                v.Student.details.studentDetails.class_name = resolvedClassName;
                v.Student.details.studentDetails.section_name = resolvedSectionName;
                v.Student.details.studentDetails.father_name = fatherName;
            }
        }
    });

    return vouchers;
};

export const getFeeVouchers = async (instituteId, filters = {}, pagination = {}) => {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const where = { 
      institute_id: instituteId,
      archived: false  // Exclude archived vouchers
    };

    if (filters.branch_id) {
        where.branch_id = filters.branch_id;
    }

    if (filters.month) where.month = filters.month;
    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;
    if (filters.student_id) where.student_id = Array.isArray(filters.student_id) ? { [Op.in]: filters.student_id } : filters.student_id;
    if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;

    if (filters.search) {
        const searchVal = `%${filters.search}%`;
        where[Op.or] = [
            { voucher_number: { [Op.iLike]: searchVal } },
            { '$Student.first_name$': { [Op.iLike]: searchVal } },
            { '$Student.last_name$': { [Op.iLike]: searchVal } },
            { '$Student.registration_no$': { [Op.iLike]: searchVal } },
            { '$Student.email$': { [Op.iLike]: searchVal } }
        ];
    }

    const { count, rows } = await FeeVoucher.findAndCountAll({
        where,
        subQuery: false, // Required when using limit/offset with $Alias.field$ where clauses
        attributes: [
            'id',
            'institute_id',
            'branch_id',
            'academic_year_id',
            'student_id',
            'voucher_number',
            'month',
            'year',
            'issued_date',
            'due_date',
            'amount',
            'discount',
            'fine',
            'net_amount',
            'currency',
            'status',
            'fee_breakdown',
            'notes',
            'archived',
            'created_by',
            'created_at',
            'updated_at'
        ],
        include: [
            {
                model: User,
                as: 'Student',
                attributes: ['id', 'first_name', 'last_name', 'registration_no', 'email', 'details']
            },
            {
                model: FeePayment,
                as: 'payments',
                attributes: ['id', 'amount_paid', 'payment_method', 'payment_date', 'transaction_id', 'receipt_number']
            }
        ],
        order: [['issued_date', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    const enrichedRows = rows.map(row => {
        const voucher = row.toJSON();
        const payments = voucher.payments || [];
        const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const netAmt = Number(voucher.net_amount || 0);
        const pendingAmt = Math.max(netAmt - paidAmount, 0);
        
        return {
            ...voucher,
            netAmount: netAmt, // Compatibility
            paid_amount: Number(paidAmount.toFixed(2)),
            pending_amount: Number(pendingAmt.toFixed(2)),
            FeePayments: payments // Compatibility for frontend
        };
    });

    await resolveVouchersClassAndSection(enrichedRows);

    return {
        vouchers: enrichedRows,
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        }
    };
};

/**
 * Delete voucher (soft delete via archived flag)
 */
export const deleteVoucher = async (voucherId, instituteId, options = {}) => {
    const { transaction, branch_id } = options;
    const where = { id: voucherId, institute_id: instituteId };
    if (branch_id) where.branch_id = branch_id;

    const voucher = await FeeVoucher.findOne({
        where,
        transaction
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    if (voucher.status === 'paid') {
        throw new AppError('Cannot delete paid voucher', 400);
    }

    const paymentsCount = await FeePayment.count({
        where: { voucher_id: voucherId },
        transaction
    });

    if (paymentsCount === 0) {
        await voucher.destroy({ transaction });
    } else {
        await voucher.update({ archived: true, status: 'cancelled' }, { transaction });
    }

    return voucher;
};

/**
 * Update voucher status (mark as paid, pending, overdue, partial, cancelled)
 * Handles partial payments by tracking remaining balance
 */
export const updateVoucherStatus = async (voucherId, instituteId, newStatus, partialAmount = null, options = {}) => {
    const { transaction, updatedBy, branch_id } = options;

    const validStatuses = ['pending', 'paid', 'overdue', 'partial', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
        throw new AppError(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`, 400);
    }

    const where = { id: voucherId, institute_id: instituteId };
    if (branch_id) where.branch_id = branch_id;

    const voucher = await FeeVoucher.findOne({
        where,
        transaction
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    if (voucher.archived) {
        throw new AppError('Cannot update archived voucher', 400);
    }

    // If marking as PAID, ensure a payment record exists for the full amount
    if (newStatus === 'paid' && !options.isInternal) {
        // Calculate current paid amount
        const payments = await FeePayment.findAll({
            where: { voucher_id: voucherId },
            transaction
        });
        const totalPaidSoFar = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const netAmount = Number(voucher.net_amount || 0);
        const outstanding = Number((netAmount - totalPaidSoFar).toFixed(2));

        if (outstanding > 0) {
            // Create a payment record for the remaining balance
            await FeePayment.create(
                {
                    school_id: instituteId,
                    voucher_id: voucherId,
                    amount_paid: outstanding,
                    payment_method: 'cash', // Default to cash for quick "Mark as Paid"
                    transaction_id: `AUTO-${Date.now()}`,
                    payment_date: new Date(),
                    collected_by: updatedBy || voucher.created_by,
                    receipt_number: newReceiptNumber()
                },
                { transaction }
            );
        }
    }

    let updateData = { status: newStatus, updated_at: new Date() };
    await voucher.update(updateData, { transaction });

    // Send notification about payment status change
    try {
        const statusMessages = {
            'paid': `✅ Fee voucher #${voucher.voucher_number} has been marked as PAID`,
            'partial': `⚠️ Fee voucher #${voucher.voucher_number} has been partially paid`,
            'overdue': `⏰ Fee voucher #${voucher.voucher_number} is now OVERDUE`,
            'cancelled': `❌ Fee voucher #${voucher.voucher_number} has been CANCELLED`,
            'pending': `⏳ Fee voucher #${voucher.voucher_number} status updated to PENDING`
        };

        await createNotification({
            institute_id: instituteId,
            user_id: voucher.student_id,
            title: '💵 Fee Voucher Status Updated',
            body: statusMessages[newStatus] || 'Fee voucher status has been updated',
            type: 'fee',
            channel: 'in_app',
            data: {
                voucherId,
                voucherNumber: voucher.voucher_number,
                status: newStatus
            }
        }, true);
    } catch (error) {
        console.error('Failed to send status update notification:', error);
    }

    return voucher;
};

/**
 * Record a payment/collection against a fee voucher
 * Tracks partial payments and updates voucher status accordingly
 */
export const recordPayment = async (voucherId, instituteId, paymentData, options = {}) =>
    withTransaction(options.transaction, (transaction) =>
        recordPaymentInner(voucherId, instituteId, paymentData, { ...options, transaction })
    );

const recordPaymentInner = async (voucherId, instituteId, paymentData, options = {}) => {
    const { transaction, branch_id } = options;
    const { paymentMethod, reference, paidDate = new Date(), collectedBy } = paymentData;
    const amount = Number(paymentData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Payment amount must be a positive number', 400);
    }

    const where = { id: voucherId, institute_id: instituteId };
    if (branch_id) where.branch_id = branch_id;

    // Row lock: concurrent payments on the same voucher are serialized so they cannot overpay
    const voucher = await FeeVoucher.findOne({
        where,
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    if (voucher.archived) {
        throw new AppError('Cannot record payment against archived voucher', 400);
    }
    if (voucher.status === 'cancelled') {
        throw new AppError('Cannot record payment against a cancelled voucher', 400);
    }

    // Import FeePayment model
    const { default: FeePayment } = await import('../models/postgres/FeePayment.model.js');

    // Calculate current paid amount so far
    const previousPayments = await FeePayment.findAll({
        where: { voucher_id: voucherId },
        transaction
    });
    const totalPaidSoFar = previousPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
    const netAmount = Number(voucher.net_amount || 0);
    const outstanding = Number(Math.max(netAmount - totalPaidSoFar, 0).toFixed(2));
    const payAmount = Number(Number(amount).toFixed(2));

    if (payAmount > outstanding + 0.01) { // 0.01 buffer for float precision
        throw new AppError(`Payment amount PKR ${payAmount} exceeds outstanding balance PKR ${outstanding}`, 400);
    }

    // Create payment record
    const paymentRecord = await FeePayment.create(
        {
            school_id: instituteId,
            voucher_id: voucherId,
            branch_id: voucher.branch_id || null,
            amount_paid: payAmount,
            payment_method: PAYMENT_METHODS.includes(String(paymentMethod || 'cash').toLowerCase())
                ? String(paymentMethod || 'cash').toLowerCase()
                : 'other',
            transaction_id: reference || null,
            payment_date: paidDate,
            collected_by: collectedBy,
            receipt_number: newReceiptNumber()
        },
        { transaction }
    );

    // Calculate remaining balance correctly (Total Net - All Payments)
    const totalPaidAfterThis = Number((totalPaidSoFar + payAmount).toFixed(2));
    const remainingBalance = Number(Math.max(netAmount - totalPaidAfterThis, 0).toFixed(2));

    // Update voucher status based on total payment amount
    let newStatus = 'partial';
    if (remainingBalance <= 0.01) { 
        newStatus = 'paid';
    }

    await updateVoucherStatus(voucherId, instituteId, newStatus, amount, { transaction, isInternal: true });

    // Send payment confirmation notification
    try {
        const { createNotification } = await import('./notification.service.js');
        await createNotification({
            institute_id: instituteId,
            user_id: voucher.student_id,
            title: '💳 Payment Received',
            body: `Payment of PKR ${payAmount.toFixed(2)} received for voucher #${voucher.voucher_number}`,
            type: 'fee',
            channel: 'in_app',
            data: {
                voucherId,
                amount: payAmount,
                remainingBalance,
                status: newStatus
            }
        }, true);
    } catch (error) {
        console.error('Failed to send payment notification:', error);
    }

    return paymentRecord;
};

/**
 * Get payment history for a voucher
 */
export const getPaymentHistory = async (voucherId, instituteId, options = {}) => {
    const { transaction, branch_id } = options;
    const { default: FeePayment } = await import('../models/postgres/FeePayment.model.js');
    const { default: User } = await import('../models/postgres/User.model.js');

    const where = { id: voucherId, institute_id: instituteId };
    if (branch_id) where.branch_id = branch_id;

    const voucher = await FeeVoucher.findOne({
        where
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    const payments = await FeePayment.findAll({
        where: { voucher_id: voucherId },
        attributes: [
            'id',
            'amount_paid',
            'payment_method',
            'transaction_id',
            'payment_date',
            'receipt_number',
            'notes',
            'created_at'
        ],
        include: [
            {
                model: User,
                as: 'collector',
                attributes: ['id', 'first_name', 'last_name'],
                required: false
            }
        ],
        order: [['payment_date', 'ASC']]
    });

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
    const remaining = Math.max(voucher.net_amount - totalPaid, 0);

    return {
        voucher: {
            id: voucher.id,
            voucher_number: voucher.voucher_number,
            net_amount: voucher.net_amount,
            status: voucher.status
        },
        payments,
        summary: {
            totalPaid,
            remaining,
            totalPayments: payments.length,
            fullyPaid: remaining === 0
        }
    };
};

/**
 * Get payment summary for a fee type (monthly, annual, lab)
 * Shows collection status, pending, and defaulters
 */
export const getPaymentSummary = async (feeTypeId, instituteId, filters = {}, options = {}) => {
    const { month, year } = filters;
    const { transaction } = options;

    // Build where clause
    const whereClause = {
        institute_id: instituteId,
        fee_type: feeTypeId,
        archived: false
    };

    if (filters.branch_id) whereClause.branch_id = filters.branch_id;
    if (month) whereClause.month = month;
    if (year) whereClause.year = year;

    const vouchers = await FeeVoucher.findAll({
        where: whereClause,
        attributes: [
            'id',
            'voucher_number',
            'net_amount',
            'status',
            'issued_date',
            'due_date',
            'student_id'
        ],
        include: [
            {
                association: 'Student',
                attributes: ['id', 'first_name', 'last_name', 'registration_no'],
                required: false
            }
        ],
        raw: false,
        transaction
    });

    // Import FeePayment for payment calculations
    const { default: FeePayment } = await import('../models/postgres/FeePayment.model.js');

    // Get all payments for these vouchers
    const voucherIds = vouchers.map(v => v.id);
    const payments = await FeePayment.findAll({
        where: { voucher_id: { [Op.in]: voucherIds } }
    });

    // Create payment map for quick lookup
    const paymentMap = {};
    payments.forEach(p => {
        if (!paymentMap[p.voucher_id]) paymentMap[p.voucher_id] = [];
        paymentMap[p.voucher_id].push(p);
    });

    // Categorize vouchers
    const summary = {
        total: vouchers.length,
        totalAmount: 0,
        collected: {
            count: 0,
            amount: 0,
            vouchers: []
        },
        partial: {
            count: 0,
            amount: 0,
            vouchers: []
        },
        pending: {
            count: 0,
            amount: 0,
            vouchers: []
        },
        overdue: {
            count: 0,
            amount: 0,
            vouchers: []
        },
        defaulters: {
            count: 0,
            amount: 0,
            vouchers: []
        }
    };

    const now = new Date();

    vouchers.forEach(voucher => {
        const voucherPayments = paymentMap[voucher.id] || [];
        const totalPaid = voucherPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
        const remaining = voucher.net_amount - totalPaid;

        summary.totalAmount += voucher.net_amount;

        const voucherInfo = {
            id: voucher.id,
            voucher_number: voucher.voucher_number,
            amount: voucher.net_amount,
            paid: totalPaid,
            remaining,
            student: voucher.Student ? `${voucher.Student.first_name} ${voucher.Student.last_name}` : 'N/A',
            student_id: voucher.student_id,
            issuedDate: voucher.issued_date,
            dueDate: voucher.due_date
        };

        if (remaining === 0) {
            summary.collected.count++;
            summary.collected.amount += voucher.net_amount;
            summary.collected.vouchers.push(voucherInfo);
        } else if (remaining > 0 && remaining < voucher.net_amount) {
            summary.partial.count++;
            summary.partial.amount += remaining;
            summary.partial.vouchers.push(voucherInfo);
        } else if (voucher.due_date && now > new Date(voucher.due_date)) {
            if (remaining > 0) {
                summary.overdue.count++;
                summary.overdue.amount += remaining;
                summary.overdue.vouchers.push(voucherInfo);
            }
        } else {
            summary.pending.count++;
            summary.pending.amount += voucher.net_amount;
            summary.pending.vouchers.push(voucherInfo);
        }

        // Defaulters are overdue by 30+ days
        if (voucher.due_date) {
            const daysOverdue = Math.floor((now - new Date(voucher.due_date)) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 30 && remaining > 0) {
                summary.defaulters.count++;
                summary.defaulters.amount += remaining;
                summary.defaulters.vouchers.push(voucherInfo);
            }
        }
    });

    return summary;
};

/**
 * Bulk delete vouchers (soft delete via archived flag)
 */
export const bulkDeleteVouchers = async (voucherIds, instituteId, options = {}) => {
    const { transaction, branch_id } = options;

    if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
        throw new AppError('No voucher IDs provided', 400);
    }

    const where = {
        id: { [Op.in]: voucherIds },
        institute_id: instituteId
    };
    if (branch_id) where.branch_id = branch_id;

    const vouchers = await FeeVoucher.findAll({
        where,
        transaction
    });

    const undeletable = vouchers.filter(v => v.status === 'paid');
    if (undeletable.length > 0) {
        throw new AppError(`Cannot delete paid vouchers: ${undeletable.map(v => v.voucher_number).join(', ')}`, 400);
    }

    for (const v of vouchers) {
        const pCount = await FeePayment.count({ where: { voucher_id: v.id }, transaction });
        if (pCount === 0) {
            await v.destroy({ transaction });
        } else {
            await v.update({ archived: true, status: 'cancelled' }, { transaction });
        }
    }

    return { deletedCount: vouchers.length };
};

export const getFeeVouchersStats = async (instituteId, filters = {}) => {
    const where = { 
        institute_id: instituteId,
        archived: false
    };
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.month) where.month = parseInt(filters.month);
    if (filters.year) where.year = parseInt(filters.year);
    if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;

    const vouchers = await FeeVoucher.findAll({
        where,
        attributes: ['id', 'net_amount', 'status'],
        include: [
            {
                model: User,
                as: 'Student',
                attributes: ['id', 'details']
            },
            {
                model: FeePayment,
                as: 'payments',
                attributes: ['amount_paid']
            }
        ]
    });

    let totalVouchers = vouchers.length;
    let paidVouchersCount = 0;
    let pendingVouchersCount = 0;
    let totalInvoiced = 0;
    let totalCollected = 0;

    const classwiseMap = {};

    vouchers.forEach(v => {
        const net = Number(v.net_amount || v.amount || 0);
        totalInvoiced += net;
        
        const payments = Array.isArray(v.payments) ? v.payments : [];
        const paidForThis = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        totalCollected += paidForThis;

        if (v.status === 'paid') {
            paidVouchersCount++;
        } else {
            pendingVouchersCount++;
        }

        // Classwise collection map
        const className = v.Student?.details?.studentDetails?.class_name || v.Student?.details?.class_name || 'Unassigned';
        if (!classwiseMap[className]) {
            classwiseMap[className] = {
                className,
                invoiced: 0,
                collected: 0
            };
        }
        classwiseMap[className].invoiced += net;
        classwiseMap[className].collected += paidForThis;
    });

    const classwiseRecovery = Object.values(classwiseMap).map(c => {
        const rate = c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 100) : 0;
        return {
            className: c.className,
            invoiced: c.invoiced,
            collected: c.collected,
            recoveryRate: rate
        };
    }).sort((a, b) => b.recoveryRate - a.recoveryRate);

    const pendingAmount = Math.max(totalInvoiced - totalCollected, 0);

    return {
        total: totalVouchers,
        pending: pendingVouchersCount,
        paid: paidVouchersCount,
        totalAmount: totalInvoiced,
        collectedAmount: totalCollected,
        pendingAmount: pendingAmount,
        classwiseRecovery
    };
};

/**
 * Get list of fee defaulters with >= 2 unpaid months
 */
export const getFeeDefaulters = async (instituteId, filters = {}) => {
    const where = {
        institute_id: instituteId,
        archived: false,
        status: { [Op.in]: ['pending', 'overdue', 'partial'] }
    };
    if (filters.branch_id) where.branch_id = filters.branch_id;

    const vouchers = await FeeVoucher.findAll({
        where,
        include: [
            {
                model: User,
                as: 'Student',
                attributes: ['id', 'first_name', 'last_name', 'registration_no', 'email', 'details']
            },
            {
                model: FeePayment,
                as: 'payments',
                attributes: ['amount_paid']
            }
        ]
    });

    const studentMap = {};
    vouchers.forEach(v => {
        const student = v.Student;
        if (!student) return;

        const studentId = student.id;
        const net = Number(v.net_amount || v.amount || 0);
        const payments = Array.isArray(v.payments) ? v.payments : [];
        const paidForThis = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const outstanding = Math.max(net - paidForThis, 0);

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthStr = v.month && monthNames[v.month - 1] ? `${monthNames[v.month - 1]} ${v.year}` : `Month ${v.month} ${v.year}`;

        if (!studentMap[studentId]) {
            studentMap[studentId] = {
                id: studentId,
                first_name: student.first_name,
                last_name: student.last_name,
                registration_no: student.registration_no || student.details?.registration_no || student.details?.studentDetails?.registration_no || 'N/A',
                class_name: student.details?.studentDetails?.class_name || student.details?.class_name || 'N/A',
                email: student.email,
                outstandingAmount: 0,
                months: new Set(),
                vouchersList: []
            };
        }

        studentMap[studentId].outstandingAmount += outstanding;
        studentMap[studentId].months.add(monthStr);
        studentMap[studentId].vouchersList.push({
            id: v.id,
            voucher_number: v.voucher_number,
            month: v.month,
            year: v.year,
            outstanding
        });
    });

    const defaulters = Object.values(studentMap)
        .filter(s => s.months.size >= 2)
        .map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            registration_no: s.registration_no,
            class_name: s.class_name,
            email: s.email,
            outstandingAmount: s.outstandingAmount,
            overdueMonthsCount: s.months.size,
            overdueMonthsList: Array.from(s.months),
            vouchers: s.vouchersList
        }));

    return defaulters;
};

/**
 * Send real-time alert/warning notifications to defaulters and their parents
 */
export const warnFeeDefaulter = async (instituteId, studentId) => {
    const student = await User.findByPk(studentId, {
        attributes: ['id', 'first_name', 'last_name', 'details']
    });
    if (!student) {
        throw new AppError('Student not found', 404);
    }
    const studentName = `${student.first_name} ${student.last_name}`.trim();

    const parents = await User.findAll({
        where: {
            school_id: instituteId,
            user_type: 'PARENT',
        },
        attributes: ['id', 'first_name', 'last_name', 'details'],
    });

    const linkedParents = parents.filter((parent) => {
        const studentIds = parent.details?.parentDetails?.student_ids || parent.student_ids || parent.details?.student_ids || [];
        return Array.isArray(studentIds) && studentIds.includes(studentId);
    });

    for (const parent of linkedParents) {
        await createNotification({
            institute_id: instituteId,
            user_id: parent.id,
            title: '🚨 FEE DEFAULTER WARNING ALERT',
            body: `Dear Parent, your child ${studentName}'s monthly tuition fee remains overdue for 2+ months. Please clear all outstanding dues immediately to avoid suspension of portal access.`,
            type: 'alert',
            channel: 'in_app',
            data: {
                studentId,
                studentName,
                action: 'PAY_FEE',
                warningType: 'defaulter'
            }
        });
    }

    await createNotification({
        institute_id: instituteId,
        user_id: studentId,
        title: '🚨 OVERDUE FEE WARNING',
        body: `Your school fee remains outstanding for 2+ months. Please ask your parents to clear the dues immediately.`,
        type: 'alert',
        channel: 'in_app',
        data: {
            studentId,
            action: 'VIEW_FEES',
            warningType: 'defaulter'
        }
    });

    return {
        success: true,
        notifiedParentsCount: linkedParents.length,
        message: `Fee warning alert sent successfully to student and ${linkedParents.length} parent(s).`
    };
};


/**
 * Get single fee voucher by ID with student enrollment and payment history
 */
export const getFeeVoucherById = async (voucherId, instituteId = null, options = {}) => {
    const where = { id: voucherId };
    if (instituteId) {
        where.institute_id = instituteId;
    }
    if (options.branch_id) {
        where.branch_id = options.branch_id;
    }
    // Students/parents: only their own / their children's vouchers (404, not 403, so IDs can't be probed)
    if (Array.isArray(options.student_ids)) {
        where.student_id = { [Op.in]: options.student_ids };
    }

    const voucherRecord = await FeeVoucher.findOne({
        where,
        attributes: [
            'id',
            'institute_id',
            'branch_id',
            'academic_year_id',
            'student_id',
            'voucher_number',
            'month',
            'year',
            'issued_date',
            'due_date',
            'amount',
            'discount',
            'fine',
            'net_amount',
            'currency',
            'status',
            'fee_breakdown',
            'notes',
            'archived',
            'created_by',
            'created_at',
            'updated_at'
        ],
        include: [
            {
                model: User,
                as: 'Student',
                attributes: ['id', 'first_name', 'last_name', 'registration_no', 'email', 'details']
            },
            {
                model: FeePayment,
                as: 'payments',
                attributes: ['id', 'amount_paid', 'payment_method', 'payment_date', 'transaction_id', 'receipt_number']
            },
            {
                model: Institute,
                as: 'institute',
                attributes: ['id', 'name', 'code', 'logo_url', 'settings', 'phone', 'address']
            }
        ]
    });

    if (!voucherRecord) {
        throw new AppError('Fee voucher not found', 404);
    }

    const voucher = voucherRecord.toJSON();
    // Pending payment requests live in fee_breakdown._payment_requests; expose them separately
    const paymentRequests = voucher.fee_breakdown?._payment_requests || [];
    if (voucher.fee_breakdown && '_payment_requests' in voucher.fee_breakdown) {
        const { _payment_requests, ...cleanBreakdown } = voucher.fee_breakdown;
        voucher.fee_breakdown = cleanBreakdown;
    }
    voucher.payment_requests = paymentRequests;
    const payments = voucher.payments || [];
    const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
    const netAmt = Number(voucher.net_amount || 0);
    const pendingAmt = Math.max(netAmt - paidAmount, 0);

    const enriched = {
        ...voucher,
        netAmount: netAmt,
        paid_amount: Number(paidAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        amount_paid: Number(paidAmount.toFixed(2)),
        pending_amount: Number(pendingAmt.toFixed(2)),
        pendingAmount: Number(pendingAmt.toFixed(2)),
        FeePayments: payments,
        payments
    };

    await resolveVouchersClassAndSection([enriched]);
    return enriched;
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT REQUESTS (parent/student "I paid" -> admin confirms)
// Stored in fee_breakdown._payment_requests (JSONB) so no schema change is needed.
// A request never changes the voucher status; only confirmPaymentRequest does,
// through recordPayment (which locks the voucher and prevents overpayment).
// ─────────────────────────────────────────────────────────────────────────────

const sumPayments = async (voucherId, transaction) => {
    const payments = await FeePayment.findAll({ where: { voucher_id: voucherId }, transaction });
    return payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
};

export const createPaymentRequest = async (voucherId, instituteId, requester, data = {}, options = {}) =>
    withTransaction(options.transaction, async (transaction) => {
        const voucher = await FeeVoucher.findOne({
            where: { id: voucherId, institute_id: instituteId },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!voucher) throw new AppError('Voucher not found', 404);
        if (Array.isArray(options.student_ids) && !options.student_ids.includes(voucher.student_id)) {
            throw new AppError('Voucher not found', 404);
        }
        if (voucher.archived || voucher.status === 'cancelled') throw new AppError('This voucher cannot be paid', 400);
        if (voucher.status === 'paid') throw new AppError('This voucher is already paid', 400);

        const paidSoFar = await sumPayments(voucher.id, transaction);
        const outstanding = Number(Math.max(Number(voucher.net_amount || 0) - paidSoFar, 0).toFixed(2));
        if (outstanding <= 0) throw new AppError('This voucher has no outstanding balance', 400);

        const amount = data.amount === undefined || data.amount === '' ? outstanding : Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Payment amount must be a positive number', 400);
        if (amount > outstanding + 0.01) {
            throw new AppError(`Payment amount PKR ${amount} exceeds outstanding balance PKR ${outstanding}`, 400);
        }

        const breakdown = { ...(voucher.fee_breakdown || {}) };
        const requests = Array.isArray(breakdown._payment_requests) ? [...breakdown._payment_requests] : [];
        if (requests.filter((r) => r.status === 'pending' && r.requested_by === requester.id).length >= 3) {
            throw new AppError('You already have pending payment requests for this voucher. Please wait for the school to review them.', 429);
        }

        const method = String(data.payment_method || data.paymentMethod || 'other').toLowerCase();
        const request = {
            id: uuidv4(),
            status: 'pending',
            amount: Number(amount.toFixed(2)),
            payment_method: PAYMENT_METHODS.includes(method) ? method : 'other',
            transaction_id: data.transaction_id || data.reference || null,
            note: data.note || data.notes || null,
            proof_url: data.proof_url || null,
            requested_by: requester.id,
            requested_by_name: requester.name || null,
            created_at: new Date().toISOString()
        };
        requests.push(request);
        breakdown._payment_requests = requests;
        voucher.fee_breakdown = breakdown;
        voucher.changed('fee_breakdown', true);
        await voucher.save({ transaction });

        try {
            await broadcastNotification({
                institute_id: instituteId,
                branch_id: voucher.branch_id || undefined,
                recipient_type: 'ALL_ADMINS',
                title: '💳 Fee payment awaiting confirmation',
                body: `${requester.name || 'A parent'} reported a payment of PKR ${request.amount} for voucher #${voucher.voucher_number}.`,
                type: 'fee',
                channel: 'in_app',
                data: { voucherId: voucher.id, requestId: request.id, studentId: voucher.student_id }
            }, true);
        } catch (err) {
            logger.error(`Failed to notify admins of payment request: ${err.message}`);
        }

        return { request, voucher: { id: voucher.id, voucher_number: voucher.voucher_number, status: voucher.status, net_amount: Number(voucher.net_amount || 0), outstanding } };
    });

export const getPaymentRequests = async (instituteId, filters = {}) => {
    const where = {
        institute_id: instituteId,
        archived: false,
        [Op.and]: [sequelize.where(sequelize.fn('jsonb_exists', sequelize.col('fee_breakdown'), '_payment_requests'), true)]
    };
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.voucherId) where.id = filters.voucherId;
    const vouchers = await FeeVoucher.findAll({
        where,
        attributes: ['id', 'voucher_number', 'student_id', 'branch_id', 'net_amount', 'status', 'fee_breakdown'],
        include: [{ model: User, as: 'Student', attributes: ['id', 'first_name', 'last_name', 'registration_no'] }],
        order: [['updated_at', 'DESC']],
        limit: 500
    });
    const rows = [];
    for (const v of vouchers) {
        for (const r of v.fee_breakdown?._payment_requests || []) {
            if (filters.status && r.status !== filters.status) continue;
            rows.push({
                ...r,
                voucher_id: v.id,
                voucher_number: v.voucher_number,
                voucher_status: v.status,
                net_amount: Number(v.net_amount || 0),
                student: v.Student ? { id: v.Student.id, name: `${v.Student.first_name} ${v.Student.last_name}`.trim(), registration_no: v.Student.registration_no } : null
            });
        }
    }
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return rows;
};

/** Student/parent view of their own requests for a voucher */
export const getOwnPaymentRequests = async (voucherId, instituteId, studentIds) => {
    const voucher = await FeeVoucher.findOne({
        where: { id: voucherId, institute_id: instituteId, student_id: { [Op.in]: studentIds } },
        attributes: ['id', 'fee_breakdown']
    });
    return voucher?.fee_breakdown?._payment_requests || [];
};

export const reviewPaymentRequest = async (voucherId, requestId, instituteId, reviewer, decision, data = {}, options = {}) => {
    if (!['confirm', 'reject'].includes(decision)) throw new AppError("action must be 'confirm' or 'reject'", 400);
    return withTransaction(options.transaction, async (transaction) => {
        const where = { id: voucherId, institute_id: instituteId };
        if (options.branch_id) where.branch_id = options.branch_id;
        const voucher = await FeeVoucher.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
        if (!voucher) throw new AppError('Voucher not found', 404);

        const breakdown = { ...(voucher.fee_breakdown || {}) };
        const requests = Array.isArray(breakdown._payment_requests) ? breakdown._payment_requests.map((r) => ({ ...r })) : [];
        const request = requests.find((r) => r.id === requestId);
        if (!request) throw new AppError('Payment request not found', 404);
        if (request.status !== 'pending') throw new AppError(`This request was already ${request.status}`, 409);

        let payment = null;
        if (decision === 'confirm') {
            payment = await recordPaymentInner(voucherId, instituteId, {
                amount: data.amount !== undefined ? data.amount : request.amount,
                paymentMethod: request.payment_method,
                reference: request.transaction_id,
                collectedBy: reviewer.id
            }, { transaction, branch_id: options.branch_id });
            request.status = 'confirmed';
            request.payment_id = payment.id;
            request.receipt_number = payment.receipt_number;
        } else {
            request.status = 'rejected';
            request.reject_reason = data.reason || null;
        }
        request.reviewed_by = reviewer.id;
        request.reviewed_at = new Date().toISOString();

        // recordPayment may have updated the voucher row; reload before writing JSON back
        await voucher.reload({ transaction });
        const fresh = { ...(voucher.fee_breakdown || {}) };
        fresh._payment_requests = requests;
        voucher.fee_breakdown = fresh;
        voucher.changed('fee_breakdown', true);
        await voucher.save({ transaction });

        try {
            await createNotification({
                institute_id: instituteId,
                user_id: request.requested_by,
                title: decision === 'confirm' ? '✅ Payment confirmed' : '❌ Payment request rejected',
                body: decision === 'confirm'
                    ? `Your payment of PKR ${request.amount} for voucher #${voucher.voucher_number} was confirmed.`
                    : `Your payment request for voucher #${voucher.voucher_number} was rejected${request.reject_reason ? ': ' + request.reject_reason : '.'}`,
                type: 'fee',
                channel: 'in_app',
                data: { voucherId: voucher.id, requestId: request.id, status: request.status }
            }, true);
        } catch (err) {
            logger.error(`Failed to notify payment request outcome: ${err.message}`);
        }

        return { request, payment, voucher_status: voucher.status };
    });
};

export default {
    generateSingleVoucher,
    createPaymentRequest,
    getPaymentRequests,
    getOwnPaymentRequests,
    reviewPaymentRequest,
    generateVouchersForClass,
    generateVouchersForInstitute,
    getFeeVouchers,
    getFeeVoucherById,
    deleteVoucher,
    updateVoucherStatus,
    recordPayment,
    getPaymentHistory,
    getPaymentSummary,
    bulkDeleteVouchers,
    getFeeVouchersStats,
    getFeeDefaulters,
    warnFeeDefaulter
};
