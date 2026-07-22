/**
 * The Clouds Academy - Fee Voucher Service
 * Bulk voucher generation with concession support
 */

import FeeVoucher from '../models/postgres/FeeVoucher.model.js';
import User from '../models/postgres/User.model.js';
import Institute from '../models/postgres/Institute.model.js';
import FeeTemplate from '../models/postgres/FeeTemplate.model.js';
import { Op } from 'sequelize';
import { default as sequelize } from '../config/database.js';
import generateVoucherNumber from '../utils/fee/generateVoucherNumber.js';
import { AppError } from '../utils/lib/AppError.js';
import logger from '../config/logger.js';
import { broadcastNotification, createNotification } from './notification.service.js';
import FeePayment from '../models/postgres/FeePayment.model.js';

/**
 * Get next sequence number for voucher numbering per institute & month
 * Format: [INSTITUTE_CODE]-[YYYYMM]-[SEQ]
 * Uses database to maintain sequence atomically
 */
const getNextSequence = async (instituteCode, year, month) => {
  try {
    // Query to get current max sequence for this institute & month
    // Format: [CODE]-[YYYYMM]-[SEQUENCE]
    // Use SPLIT_PART to extract the sequence number from the 3rd segment
    const result = await sequelize.query(`
      SELECT COALESCE(MAX(
        CAST(SPLIT_PART(voucher_number, '-', 3) AS INTEGER)
      ), 0) + 1 as next_seq
      FROM fee_vouchers
      WHERE voucher_number LIKE $1
      AND status != 'cancelled'
    `, {
      bind: [`${instituteCode}-${year}${String(month).padStart(2, '0')}-%`],
      type: sequelize.QueryTypes.SELECT
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
        fee_type: feeType,
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
      fee_type: feeType,
      archived: false,
    },
  });
  return !!existing;
};

/**
 * Get fee amount based on type and student details
 */
const getFeeAmount = (studentDetails, feeType, feeTemplate = null) => {
    if (feeType === 'fee_template') {
        return parseFloat(feeTemplate?.total_amount) || parseFloat(feeTemplate?.calculated_totals?.final_total) || 0;
    }
  if (feeType === 'monthly') {
    return parseFloat(studentDetails.monthly_fee) || 0;
  } else if (feeType === 'annual') {
    return parseFloat(studentDetails.annual_charges) || 0;
  } else if (feeType === 'lab') {
    return parseFloat(studentDetails.lab_charges) || 0;
  } else if (feeType === 'admission') {
    return parseFloat(studentDetails.admission_charges) || 0;
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
export const generateSingleVoucher = async (
    studentId,
    instituteId,
    month,
    year,
    createdBy,
    options = {}
) => {
    let { transaction, dueDate, academicYearId, feeType = 'monthly', feeTemplateId } = options;
    let resolvedFeeType = feeType;

    // If fee template is selected, fetch it and use its fee_type
    let feeTemplate = null;
    if (feeTemplateId) {
        feeTemplate = await FeeTemplate.findOne({
            where: { id: feeTemplateId, institute_id: instituteId, is_active: true }
        });
        
        if (!feeTemplate) {
            throw new AppError('Fee template not found or is inactive', 404);
        }

        // For template-based vouchers, always store fee type as fee_template.
        resolvedFeeType = 'fee_template';
    }

    // Check if voucher already exists for this student, month, and specific fee type
    if (await voucherExists(studentId, instituteId, month, year, resolvedFeeType)) {
        throw new AppError(`${resolvedFeeType.toUpperCase()} voucher already exists for this student in ${month}/${year}`, 400);
    }

    // Get student with details
    const student = await User.findOne({
        where: { id: studentId, school_id: instituteId, user_type: 'STUDENT' },
        transaction
    });

    if (!student) {
        throw new AppError('Student not found', 404);
    }

    const studentDetails = student.details?.studentDetails || {};
    
    // Get fee amount based on resolved type
    const amount = getFeeAmount(studentDetails, resolvedFeeType, feeTemplate);

    if (amount <= 0) {
        throw new AppError(`Student has no ${resolvedFeeType} fee configured`, 400);
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
      order: [['issued_date', 'ASC']],
      transaction
    });

    for (const prevVoucher of previousVouchers) {
      // Get sum of payments for this prevVoucher
      const payments = await sequelize.models.FeePayment.findAll({
        where: { voucher_id: prevVoucher.id },
        transaction
      });
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
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
    const instituteCode = options.instituteCode || (await Institute.findByPk(instituteId, { transaction }))?.code || 'TCA';

    // Generate voucher number
    const voucherNumber = await generateVoucherNumber(
        instituteCode,
        new Date(year, month - 1, 1),
        getNextSequence
    );

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

    // Get all active students in this class
    const students = await User.findAll({
        where: {
            school_id: instituteId,
            user_type: 'STUDENT',
            is_active: true
        },
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

    const vouchers = [];
    const failed = [];

    for (const student of classStudents) {
        for (const feeTypeItem of feesToGenerate) {
            try {
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
                        instituteCode,
                        allParents,
                        isBulk: true
                    }
                );
                vouchers.push(voucher);
            } catch (error) {
                if (!error.message.includes('already exists')) {
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
    const students = await User.findAll({
        where: {
            school_id: instituteId,
            user_type: 'STUDENT',
            is_active: true
        },
        transaction
    });

    if (students.length === 0) {
        throw new AppError('No students found in this institute', 404);
    }

    const vouchers = [];
    const failed = [];

    for (const student of students) {
        for (const feeTypeItem of feesToGenerate) {
            try {
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
                        instituteCode,
                        allParents,
                        isBulk: true
                    }
                );
                vouchers.push(voucher);
            } catch (error) {
                if (!error.message.includes('already exists')) {
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
        failed: failed.length,
        failedDetails: failed,
        vouchers
    };
};

/**
 * Get all fee vouchers for institute with filters
 */
export const getFeeVouchers = async (instituteId, filters = {}, pagination = {}) => {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const where = { 
      institute_id: instituteId,
      archived: false  // Exclude archived vouchers
    };

    // If search is provided, we perform a global search within the institute (ignoring other filters)
    if (filters.search) {
        const searchVal = `%${filters.search}%`;
        where[Op.or] = [
            { voucher_number: { [Op.iLike]: searchVal } },
            { '$Student.first_name$': { [Op.iLike]: searchVal } },
            { '$Student.last_name$': { [Op.iLike]: searchVal } },
            { '$Student.registration_no$': { [Op.iLike]: searchVal } },
            { '$Student.email$': { [Op.iLike]: searchVal } }
        ];
    } else {
        // Only apply other filters if search is NOT present
        if (filters.month) where.month = filters.month;
        if (filters.year) where.year = filters.year;
        if (filters.status) where.status = filters.status;
        if (filters.student_id) where.student_id = filters.student_id;
        if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;
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
    const { transaction } = options;

    const voucher = await FeeVoucher.findOne({
        where: { id: voucherId, institute_id: instituteId },
        transaction
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    if (voucher.status === 'paid') {
        throw new AppError('Cannot delete paid voucher', 400);
    }

    await voucher.update({ archived: true }, { transaction });

    return voucher;
};

/**
 * Update voucher status (mark as paid, pending, overdue, partial, cancelled)
 * Handles partial payments by tracking remaining balance
 */
export const updateVoucherStatus = async (voucherId, instituteId, newStatus, partialAmount = null, options = {}) => {
    const { transaction, updatedBy } = options;

    const validStatuses = ['pending', 'paid', 'overdue', 'partial', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
        throw new AppError(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`, 400);
    }

    const voucher = await FeeVoucher.findOne({
        where: { id: voucherId, institute_id: instituteId },
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
                    receipt_number: `RCP-${Date.now()}`
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
export const recordPayment = async (voucherId, instituteId, paymentData, options = {}) => {
    const { transaction } = options;
    const { amount, paymentMethod, reference, paidDate = new Date(), collectedBy } = paymentData;

    const voucher = await FeeVoucher.findOne({
        where: { id: voucherId, institute_id: instituteId },
        transaction
    });

    if (!voucher) {
        throw new AppError('Voucher not found', 404);
    }

    if (voucher.archived) {
        throw new AppError('Cannot record payment against archived voucher', 400);
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
            amount_paid: amount,
            payment_method: paymentMethod,
            transaction_id: reference || null,
            payment_date: paidDate,
            collected_by: collectedBy,
            receipt_number: `RCP-${Date.now()}`
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
            body: `Payment of PKR ${amount.toFixed(2)} received for voucher #${voucher.voucher_number}`,
            type: 'fee',
            channel: 'in_app',
            data: {
                voucherId,
                amount,
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
    const { transaction } = options;
    const { default: FeePayment } = await import('../models/postgres/FeePayment.model.js');

    const voucher = await FeeVoucher.findOne({
        where: { id: voucherId, institute_id: instituteId }
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
                association: 'User',
                attributes: ['id', 'first_name', 'last_name']
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
    const { transaction } = options;

    if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
        throw new AppError('No voucher IDs provided', 400);
    }

    const vouchers = await FeeVoucher.findAll({
        where: {
            id: { [Op.in]: voucherIds },
            institute_id: instituteId
        },
        transaction
    });

    const undeletable = vouchers.filter(v => v.status === 'paid');
    if (undeletable.length > 0) {
        throw new AppError(`Cannot delete paid vouchers: ${undeletable.map(v => v.voucher_number).join(', ')}`, 400);
    }

    await FeeVoucher.update(
        { archived: true },
        {
            where: {
                id: { [Op.in]: voucherIds },
                institute_id: instituteId,
                status: { [Op.ne]: 'paid' }
            },
            transaction
        }
    );

    return { deletedCount: vouchers.length };
};

export const getFeeVouchersStats = async (instituteId, filters = {}) => {
    const where = { 
        institute_id: instituteId,
        archived: false
    };
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
export const getFeeDefaulters = async (instituteId) => {
    const vouchers = await FeeVoucher.findAll({
        where: {
            institute_id: instituteId,
            archived: false,
            status: { [Op.in]: ['pending', 'overdue', 'partial'] }
        },
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

export default {
    generateSingleVoucher,
    generateVouchersForClass,
    generateVouchersForInstitute,
    getFeeVouchers,
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
