// backend/src/services/exam.service.js

import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import models from '../models/postgres/index.js';

const { Exam, ExamResult, User, Class, Section, AcademicYear, sequelize } = models;

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate exam dates from subject schedules
 */
const calculateExamDates = (subjectSchedules) => {
  if (!subjectSchedules?.length) {
    return { start_date: null, end_date: null };
  }
  
  const dates = subjectSchedules
    .map(s => s.date)
    .filter(d => d);
    
  if (dates.length === 0) {
    return { start_date: null, end_date: null };
  }
  
  return {
    start_date: dates.reduce((min, d) => d < min ? d : min, dates[0]),
    end_date: dates.reduce((max, d) => d > max ? d : max, dates[0])
  };
};

/**
 * Calculate total marks from subject schedules
 */
const calculateTotalMarks = (subjectSchedules) => {
  if (!subjectSchedules?.length) return 0;
  return subjectSchedules.reduce((sum, s) => sum + (parseInt(s.total_marks) || 0), 0);
};

/**
 * Get grade from percentage
 */
const getGradeFromPercentage = (percentage, gradingSystem) => {
  const grades = gradingSystem?.grades || [
    { min: 90, max: 100, grade: 'A+', gpa: 4.0, remarks: 'Excellent' },
    { min: 80, max: 89, grade: 'A', gpa: 3.7, remarks: 'Very Good' },
    { min: 70, max: 79, grade: 'B', gpa: 3.0, remarks: 'Good' },
    { min: 60, max: 69, grade: 'C', gpa: 2.5, remarks: 'Satisfactory' },
    { min: 50, max: 59, grade: 'D', gpa: 2.0, remarks: 'Pass' },
    { min: 0, max: 49, grade: 'F', gpa: 0, remarks: 'Fail' }
  ];

  for (const grade of grades) {
    if (percentage >= grade.min && percentage <= grade.max) {
      return { grade: grade.grade, gpa: grade.gpa, remarks: grade.remarks };
    }
  }

  return { grade: 'F', gpa: 0, remarks: 'Fail' };
};

/**
 * Calculate student result
 */
const calculateStudentResult = async (exam, studentId, subjectMarksMap, isPresent = true) => {
  const processedSubjects = [];
  let totalObtained = 0;
  let totalPossible = 0;

  for (const subject of exam.subject_schedules) {
    const obtained = subjectMarksMap[subject.subject_id] || 0;
    const subjectTotal = subject.total_marks || 0;
    
    totalObtained += obtained;
    totalPossible += subjectTotal;
    
    const percentage = subjectTotal > 0 ? (obtained / subjectTotal) * 100 : 0;
    const gradeInfo = getGradeFromPercentage(percentage, exam.grading_system);
    
    processedSubjects.push({
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      marks_obtained: obtained,
      total_marks: subjectTotal,
      percentage: percentage,
      grade: gradeInfo.grade,
      gpa: gradeInfo.gpa,
      remarks: obtained >= (subject.pass_marks || subjectTotal * 0.4) ? 'Pass' : 'Fail'
    });
  }

  const overallPercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
  const overallGrade = getGradeFromPercentage(overallPercentage, exam.grading_system);
  
  const status = isPresent 
    ? (overallPercentage >= exam.pass_percentage ? 'pass' : 'fail')
    : 'absent';

  return {
    subject_marks: processedSubjects,
    total_marks_obtained: totalObtained,
    total_marks: totalPossible,
    percentage: overallPercentage,
    grade: overallGrade.grade,
    gpa: overallGrade.gpa,
    status: status,
    remarks: overallGrade.remarks
  };
};

/**
 * Update exam ranks
 */
const updateExamRanks = async (examId, transaction) => {
  const results = await ExamResult.findAll({
    where: { exam_id: examId, status: { [Op.in]: ['pass', 'fail'] } },
    order: [['percentage', 'DESC']],
    transaction
  });

  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (i > 0 && result.percentage !== results[i - 1].percentage) {
      rank = i + 1;
    }
    
    let position = '';
    if (rank === 1) position = '1st';
    else if (rank === 2) position = '2nd';
    else if (rank === 3) position = '3rd';
    
    await result.update({ rank, position }, { transaction });
  }
};

/**
 * Update exam results summary cache
 */
const updateExamSummaryCache = async (examId, transaction) => {
  const results = await ExamResult.findAll({
    where: { exam_id: examId },
    attributes: ['status', 'percentage', 'total_marks_obtained', 'total_marks'],
    transaction
  });

  const totalStudents = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const absent = results.filter(r => r.status === 'absent').length;
  const percentages = results.map(r => r.percentage).filter(p => p > 0);
  const totalMarksObtained = results.reduce((sum, r) => sum + parseFloat(r.total_marks_obtained), 0);
  const totalPossibleMarks = results.reduce((sum, r) => sum + parseFloat(r.total_marks), 0);

  const summary = {
    total_students: totalStudents,
    passed,
    failed,
    absent,
    pass_percentage: totalStudents > 0 ? (passed / totalStudents) * 100 : 0,
    average_percentage: percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0,
    highest_percentage: percentages.length > 0 ? Math.max(...percentages) : 0,
    lowest_percentage: percentages.length > 0 ? Math.min(...percentages) : 0,
    total_marks_obtained: totalMarksObtained,
    total_possible_marks: totalPossibleMarks,
    overall_percentage: totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0
  };

  await Exam.update(
    { results_summary: summary },
    { where: { id: examId }, transaction }
  );

  return summary;
};

// ==================== EXAM CRUD OPERATIONS ====================

/**
 * Create new exam
 */
export const createExam = async (data, options = {}) => {
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    console.log('📝 Creating exam:', data.name);

    // Auto-calculate dates and totals
    const dates = calculateExamDates(data.subject_schedules);
    const totalMarks = calculateTotalMarks(data.subject_schedules);
    
    const examData = {
      ...data,
      start_date: dates.start_date,
      end_date: dates.end_date,
      total_marks: totalMarks,
      pass_marks: Math.round((totalMarks * (data.pass_percentage || 40)) / 100),
      code: data.code || `${data.type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };

    const exam = await Exam.create(examData, { transaction });

    if (shouldCommit) await transaction.commit();
    
    console.log('✅ Exam created:', exam.id);
    return exam;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    console.error('❌ Create exam error:', error);
    throw error;
  }
};

/**
 * Get all exams with filters
 */
export const getAllExams = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = { school_id: filters.institute_id };

  // Basic filters
  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;
  if (filters.entity_type) where.entity_type = filters.entity_type;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  // JSONB filters
  if (filters.class_id) where['entity_ids.class_id'] = filters.class_id;
  if (filters.section_id) where['entity_ids.section_id'] = filters.section_id;

  // Date range filters
  if (filters.from_date) {
    where.start_date = { [Op.gte]: filters.from_date };
  }
  if (filters.to_date) {
    where.end_date = { [Op.lte]: filters.to_date };
  }

  // Search
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { code: { [Op.iLike]: `%${filters.search}%` } },
      { description: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  const { count, rows } = await Exam.findAndCountAll({
    where,
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name', 'start_date', 'end_date'] }
    ],
    order: [[filters.orderBy || 'start_date', filters.orderDirection || 'DESC']],
    limit,
    offset,
    paranoid: filters.includeDeleted !== 'true'
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      hasNext: page * limit < count,
      hasPrev: page > 1
    }
  };
};

/**
 * Get exam by ID
 */
export const getExamById = async (id, instituteId) => {
  const exam = await Exam.findOne({
    where: { id, school_id: instituteId },
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name'] }
    ]
  });

  if (!exam) return null;

  // Get results summary if not cached
  if (!exam.results_summary?.total_students) {
    await updateExamSummaryCache(id);
    await exam.reload();
  }

  return exam;
};

/**
 * Update exam
 */
export const updateExam = async (id, instituteId, updateData, options = {}) => {
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    const exam = await Exam.findOne({
      where: { id, school_id: instituteId },
      transaction
    });

    if (!exam) throw new Error('Exam not found');

    // If subject schedules updated, recalculate everything
    if (updateData.subject_schedules) {
      const dates = calculateExamDates(updateData.subject_schedules);
      const totalMarks = calculateTotalMarks(updateData.subject_schedules);
      
      updateData.start_date = dates.start_date;
      updateData.end_date = dates.end_date;
      updateData.total_marks = totalMarks;
      updateData.pass_marks = Math.round((totalMarks * (updateData.pass_percentage || exam.pass_percentage || 40)) / 100);
    }

    // Update fields
    const allowedFields = [
      'name', 'code', 'description', 'type', 'category', 'entity_type', 'entity_ids',
      'academic_year_id', 'subject_schedules', 'start_date', 'end_date', 'total_marks',
      'pass_marks', 'pass_percentage', 'grading_system', 'status', 'is_published',
      'publish_results_date', 'settings', 'attachments', 'venue', 'room_no'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        exam[field] = updateData[field];
      }
    });

    exam.updated_by = updateData.updated_by;
    exam.updated_at = new Date();

    await exam.save({ transaction });

    if (shouldCommit) await transaction.commit();
    
    return exam;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

/**
 * Delete exam (soft delete)
 */
export const deleteExam = async (id, instituteId) => {
  const transaction = await sequelize.transaction();

  try {
    const exam = await Exam.findOne({
      where: { id, school_id: instituteId },
      transaction
    });

    if (!exam) throw new Error('Exam not found');

    // Check if results exist
    const resultsCount = await ExamResult.count({ where: { exam_id: id }, transaction });
    if (resultsCount > 0) {
      throw new Error('Cannot delete exam with existing results. Archive it instead.');
    }

    await exam.destroy({ transaction });
    await transaction.commit();

    return { success: true, message: 'Exam deleted successfully' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Update exam status
 */
export const updateExamStatus = async (id, instituteId, status) => {
  const exam = await Exam.findOne({
    where: { id, school_id: instituteId }
  });

  if (!exam) throw new Error('Exam not found');

  exam.status = status;
  exam.updated_at = new Date();
  await exam.save();

  return exam;
};

/**
 * Publish exam
 */
export const publishExam = async (id, instituteId) => {
  const exam = await Exam.findOne({
    where: { id, school_id: instituteId }
  });

  if (!exam) throw new Error('Exam not found');

  exam.is_published = true;
  exam.status = 'scheduled';
  exam.updated_at = new Date();
  await exam.save();

  return exam;
};

// ==================== RESULTS MANAGEMENT ====================

/**
 * Add/Update exam results (bulk)
 */
export const addExamResults = async (examId, instituteId, results, options = {}) => {
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    const exam = await Exam.findOne({
      where: { id: examId, school_id: instituteId },
      transaction
    });

    if (!exam) throw new Error('Exam not found');
    if (exam.status === 'results_published') {
      throw new Error('Results already published, cannot modify');
    }

    const processed = [];
    const errors = [];

    for (const result of results) {
      try {
        // Create subject marks map
        const subjectMarksMap = {};
        result.subject_marks.forEach(sm => {
          subjectMarksMap[sm.subject_id] = sm.marks_obtained;
        });

        // ✅ Validate marks don't exceed subject total marks
        if (result.is_present !== false) {
          for (const [subjectId, marksObtained] of Object.entries(subjectMarksMap)) {
            const subjectSchedule = exam.subject_schedules.find(s => s.subject_id === subjectId);
            if (subjectSchedule && marksObtained > subjectSchedule.total_marks) {
              throw new Error(
                `Marks (${marksObtained}) for subject ${subjectSchedule.subject_name} cannot exceed total marks (${subjectSchedule.total_marks})`
              );
            }
          }
        }

        // Calculate result
        const calculated = await calculateStudentResult(
          exam,
          result.student_id,
          subjectMarksMap,
          result.is_present !== false
        );

        // Check if result exists
        const existing = await ExamResult.findOne({
          where: { exam_id: examId, student_id: result.student_id },
          transaction
        });

        if (existing) {
          await existing.update({
            subject_marks: calculated.subject_marks,
            total_marks_obtained: calculated.total_marks_obtained,
            total_marks: calculated.total_marks,
            percentage: calculated.percentage,
            grade: calculated.grade,
            gpa: calculated.gpa,
            status: calculated.status,
            is_present: result.is_present !== false,
            absent_reason: result.absent_reason,
            teacher_remarks: result.teacher_remarks,
            updated_by: options.userId,
            updated_at: new Date()
          }, { transaction });
          
          processed.push({ student_id: result.student_id, action: 'updated' });
        } else {
          await ExamResult.create({
            id: uuidv4(),
            exam_id: examId,
            student_id: result.student_id,
            subject_marks: calculated.subject_marks,
            total_marks_obtained: calculated.total_marks_obtained,
            total_marks: calculated.total_marks,
            percentage: calculated.percentage,
            grade: calculated.grade,
            gpa: calculated.gpa,
            status: calculated.status,
            is_present: result.is_present !== false,
            absent_reason: result.absent_reason,
            teacher_remarks: result.teacher_remarks,
            created_by: options.userId,
            updated_by: options.userId
          }, { transaction });
          
          processed.push({ student_id: result.student_id, action: 'created' });
        }
      } catch (error) {
        errors.push({ student_id: result.student_id, error: error.message });
      }
    }

    // Update ranks and summary
    await updateExamRanks(examId, transaction);
    await updateExamSummaryCache(examId, transaction);

    // Update exam status if all results are in
    const totalStudents = await User.count({
      where: {
        school_id: instituteId,
        user_type: 'STUDENT',
        'details.studentDetails.class_id': exam.class_id,
        ...(exam.section_id && { 'details.studentDetails.section_id': exam.section_id })
      },
      transaction
    });

    const resultsCount = await ExamResult.count({ where: { exam_id: examId }, transaction });

    if (resultsCount >= totalStudents && exam.status === 'ongoing') {
      await exam.update({ status: 'completed' }, { transaction });
    }

    if (shouldCommit) await transaction.commit();

    return {
      processed: processed.length,
      failed: errors.length,
      errors
    };
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

/**
 * Get exam results with student population
 * Fetches students from exam's class/section and returns their results
 * Priority: Active sessions matching academic year > Any active sessions > All students
 */
export const getExamResults = async (examId, instituteId, filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  // 1. Get exam with class/section info
  const exam = await Exam.findOne({
    where: { id: examId, school_id: instituteId },
    attributes: ['id', 'class_id', 'section_id', 'academic_year_id', 'subject_schedules', 'results_summary']
  });

  if (!exam) throw new Error('Exam not found');

  // 2. Fetch all students from exam's class/section
  let studentWhere = {
    school_id: instituteId,
    user_type: 'STUDENT',
    is_active: true,
    'details.studentDetails.class_id': exam.class_id
  };

  // Include section filter if specific section selected
  if (exam.section_id || filters.section_id) {
    const sectionId = filters.section_id || exam.section_id;
    studentWhere['details.studentDetails.section_id'] = sectionId;
  }

  const allStudents = await User.findAll({
    where: studentWhere,
    attributes: ['id', 'first_name', 'last_name', 'email', 'registration_no', 'details'],
    order: [['first_name', 'ASC']]
  });

  console.log(`[getExamResults] Found ${allStudents.length} students for class ${exam.class_id}`);

  // 3. Filter students - prioritize by academic session status
  const filteredStudents = allStudents.filter(student => {
    const studentDetails = student.details?.studentDetails || {};
    const academicSessions = Array.isArray(studentDetails.academicSessions) 
      ? studentDetails.academicSessions 
      : [];
    
    // Priority 1: Has active session matching exam's academic_year_id
    const hasMatchingActiveSession = academicSessions.some(session => 
      session.academic_year_id === exam.academic_year_id && 
      String(session.status || '').toLowerCase() === 'active'
    );
    if (hasMatchingActiveSession) return true;
    
    // Priority 2: Has ANY active session (might be different year but still active)
    const hasAnyActiveSession = academicSessions.some(session =>
      String(session.status || '').toLowerCase() === 'active'
    );
    if (hasAnyActiveSession) return true;
    
    // Priority 3: No academic sessions setup yet - include for exam entry
    if (academicSessions.length === 0) return true;
    
    return false;
  });

  console.log(`[getExamResults] After filtering: ${filteredStudents.length} students eligible for exam`);

  // 4. Get existing exam results for these students
  const studentIds = filteredStudents.map(s => s.id);
  const existingResults = await ExamResult.findAll({
    where: {
      exam_id: examId,
      student_id: { [Op.in]: studentIds }
    }
  });

  // Create a map for quick lookup
  const resultsMap = new Map(existingResults.map(r => [r.student_id, r]));

  // 5. Create results with student data (using pagination)
  const paginatedStudents = filteredStudents.slice(offset, offset + limit);
  
  const resultsWithStudents = paginatedStudents.map(student => {
    const existingResult = resultsMap.get(student.id);
    
    if (existingResult) {
      return {
        ...existingResult.dataValues,
        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          registration_no: student.registration_no || '',
          roll_number: student.details?.studentDetails?.roll_no || '',
          class_name: student.details?.studentDetails?.class_name || 'N/A',
          section_name: student.details?.studentDetails?.section_name || 'N/A',
          guardian_name: student.details?.studentDetails?.father_name || 'N/A',
          guardian_phone: student.details?.studentDetails?.father_phone || 'N/A'
        }
      };
    }
    
    // Return placeholder result for students without results yet
    return {
      id: null,
      exam_id: examId,
      student_id: student.id,
      subject_marks: [],
      total_marks_obtained: 0,
      total_marks: 0,
      percentage: 0,
      grade: null,
      status: 'pending',
      is_present: true,
      created_at: null,
      updated_at: null,
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        registration_no: student.registration_no || '',
        roll_number: student.details?.studentDetails?.roll_no || '',
        class_name: student.details?.studentDetails?.class_name || 'N/A',
        section_name: student.details?.studentDetails?.section_name || 'N/A',
        guardian_name: student.details?.studentDetails?.father_name || 'N/A',
        guardian_phone: student.details?.studentDetails?.father_phone || 'N/A'
      }
    };
  });

  // 6. Get summary
  const summary = exam.results_summary || await updateExamSummaryCache(examId);

  return {
    data: resultsWithStudents,
    pagination: {
      total: filteredStudents.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredStudents.length / limit),
      hasNext: page * limit < filteredStudents.length,
      hasPrev: page > 1
    },
    summary
  };
};

/**
 * Update single exam result
 */
export const updateExamResult = async (resultId, instituteId, updateData, options = {}) => {
  const transaction = options.transaction || await sequelize.transaction();
  let shouldCommit = !options.transaction;

  try {
    const result = await ExamResult.findOne({
      where: { id: resultId },
      include: [{ model: Exam, as: 'exam' }],
      transaction
    });

    if (!result) throw new Error('Result not found');
    if (result.exam.school_id !== instituteId) throw new Error('Unauthorized');
    if (result.exam.status === 'results_published') {
      throw new Error('Results already published, cannot update');
    }

    // If subject marks are being updated, recalculate
    if (updateData.subject_marks) {
      const subjectMarksMap = {};
      updateData.subject_marks.forEach(sm => {
        subjectMarksMap[sm.subject_id] = sm.marks_obtained;
      });

      const calculated = await calculateStudentResult(
        result.exam,
        result.student_id,
        subjectMarksMap,
        updateData.is_present !== undefined ? updateData.is_present : result.is_present
      );

      updateData.subject_marks = calculated.subject_marks;
      updateData.total_marks_obtained = calculated.total_marks_obtained;
      updateData.total_marks = calculated.total_marks;
      updateData.percentage = calculated.percentage;
      updateData.grade = calculated.grade;
      updateData.gpa = calculated.gpa;
      updateData.status = calculated.status;
    }

    updateData.updated_by = updateData.updated_by;
    updateData.updated_at = new Date();

    await result.update(updateData, { transaction });

    // Update ranks and summary
    await updateExamRanks(result.exam_id, transaction);
    await updateExamSummaryCache(result.exam_id, transaction);

    if (shouldCommit) await transaction.commit();

    return result;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

/**
 * Publish exam results
 */
export const publishExamResults = async (examId, instituteId, publishDate) => {
  const transaction = await sequelize.transaction();

  try {
    const exam = await Exam.findOne({
      where: { id: examId, school_id: instituteId },
      transaction
    });

    if (!exam) throw new Error('Exam not found');

    exam.is_published = true;
    exam.publish_results_date = publishDate || new Date().toISOString().split('T')[0];
    exam.status = 'results_published';
    exam.updated_at = new Date();

    await exam.save({ transaction });
    await transaction.commit();

    return exam;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete exam result
 */
export const deleteExamResult = async (resultId, instituteId) => {
  const transaction = await sequelize.transaction();

  try {
    const result = await ExamResult.findOne({
      where: { id: resultId },
      include: [{ model: Exam, as: 'exam' }],
      transaction
    });

    if (!result) throw new Error('Result not found');
    if (result.exam.school_id !== instituteId) throw new Error('Unauthorized');
    if (result.exam.status === 'results_published') {
      throw new Error('Results already published, cannot delete');
    }

    await result.destroy({ transaction });

    // Update ranks and summary
    await updateExamRanks(result.exam_id, transaction);
    await updateExamSummaryCache(result.exam_id, transaction);

    await transaction.commit();

    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Export exam results as CSV
 */
export const exportExamResults = async (examId, instituteId) => {
  const exam = await Exam.findOne({
    where: { id: examId, school_id: instituteId }
  });

  if (!exam) throw new Error('Exam not found');

  const results = await ExamResult.findAll({
    where: { exam_id: examId },
    include: [{ model: User, as: 'student', attributes: ['first_name', 'last_name', 'roll_number'] }],
    order: [['rank', 'ASC']]
  });

  // Create CSV headers
  const headers = [
    'Roll Number', 'Student Name', 'Total Marks', 'Percentage', 'Grade', 'Rank', 'Status'
  ];

  // Add subject headers
  exam.subject_schedules.forEach(subject => {
    headers.push(`${subject.subject_name} (Obtained)`);
    headers.push(`${subject.subject_name} (Total)`);
    headers.push(`${subject.subject_name} (%)`);
  });

  const rows = results.map(result => {
    const row = [
      result.student.roll_number,
      `${result.student.first_name} ${result.student.last_name}`,
      `${result.total_marks_obtained}/${result.total_marks}`,
      result.percentage,
      result.grade,
      result.rank,
      result.status
    ];

    // Add subject-wise marks
    exam.subject_schedules.forEach(subject => {
      const subjectMark = result.subject_marks.find(s => s.subject_id === subject.subject_id);
      row.push(subjectMark?.marks_obtained || 0);
      row.push(subject.total_marks || 0);
      row.push(subjectMark?.percentage || 0);
    });

    return row;
  });

  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

  return csvContent;
};

// ==================== ANALYTICS ====================

/**
 * Get exam analytics
 */
export const getExamAnalytics = async (examId, instituteId) => {
  const exam = await Exam.findOne({
    where: { id: examId, school_id: instituteId }
  });

  if (!exam) throw new Error('Exam not found');

  const results = await ExamResult.findAll({
    where: { exam_id: examId },
    include: [{ model: User, as: 'student', attributes: ['first_name', 'last_name'] }]
  });

  const totalStudents = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const absent = results.filter(r => r.status === 'absent').length;
  const percentages = results.map(r => r.percentage).filter(p => p > 0);

  // Grade distribution
  const gradeDistribution = {
    'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
  };

  results.forEach(r => {
    if (gradeDistribution[r.grade] !== undefined) {
      gradeDistribution[r.grade]++;
    }
  });

  // Subject-wise analysis
  const subjectAnalysis = {};

  results.forEach(result => {
    result.subject_marks.forEach(subject => {
      if (!subjectAnalysis[subject.subject_id]) {
        subjectAnalysis[subject.subject_id] = {
          subject_name: subject.subject_name,
          marks_list: [],
          total_students: 0,
          passed: 0,
          failed: 0
        };
      }

      const analysis = subjectAnalysis[subject.subject_id];
      analysis.marks_list.push(subject.marks_obtained);
      analysis.total_students++;
      if (subject.marks_obtained >= subject.total_marks / 2) {
        analysis.passed++;
      } else {
        analysis.failed++;
      }
    });
  });

  const subjectAnalysisArray = Object.values(subjectAnalysis).map(analysis => ({
    subject_name: analysis.subject_name,
    average_marks: analysis.marks_list.reduce((a, b) => a + b, 0) / analysis.marks_list.length,
    highest_marks: Math.max(...analysis.marks_list),
    lowest_marks: Math.min(...analysis.marks_list),
    pass_percentage: (analysis.passed / analysis.total_students) * 100
  }));

  // Top performers
  const topPerformers = results
    .filter(r => r.status === 'pass')
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5)
    .map((r, index) => ({
      student_name: `${r.student.first_name} ${r.student.last_name}`,
      percentage: r.percentage,
      rank: index + 1
    }));

  return {
    overview: {
      total_students: totalStudents,
      passed,
      failed,
      absent,
      pass_percentage: totalStudents > 0 ? (passed / totalStudents) * 100 : 0,
      average_percentage: percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0,
      highest_percentage: percentages.length > 0 ? Math.max(...percentages) : 0,
      lowest_percentage: percentages.length > 0 ? Math.min(...percentages) : 0
    },
    grade_distribution: gradeDistribution,
    subject_analysis: subjectAnalysisArray,
    top_performers: topPerformers
  };
};

/**
 * Generate grade sheet for student
 */
export const generateGradeSheet = async (examId, instituteId, studentId) => {
  const exam = await Exam.findOne({
    where: { id: examId, school_id: instituteId }
  });

  if (!exam) throw new Error('Exam not found');

  const result = await ExamResult.findOne({
    where: { exam_id: examId, student_id: studentId },
    include: [{ model: User, as: 'student' }]
  });

  if (!result) throw new Error('Result not found');

  // Get student class/section info
  const studentClass = exam.entity_ids.class_id ? await Class.findByPk(exam.entity_ids.class_id) : null;
  const studentSection = exam.entity_ids.section_id ? await Section.findByPk(exam.entity_ids.section_id) : null;

  return {
    student_info: {
      name: `${result.student.first_name} ${result.student.last_name}`,
      roll_number: result.student.roll_number,
      class: studentClass?.name || 'N/A',
      section: studentSection?.name || 'N/A'
    },
    exam_info: {
      name: exam.name,
      type: exam.type,
      category: exam.category,
      dates: `${exam.start_date} to ${exam.end_date}`
    },
    subject_marks: result.subject_marks,
    summary: {
      total_marks_obtained: result.total_marks_obtained,
      total_marks: result.total_marks,
      percentage: result.percentage,
      grade: result.grade,
      gpa: result.gpa,
      rank: result.rank,
      position: result.position,
      remarks: result.remarks
    }
  };
};

/**
 * Get student's exams
 */
export const getStudentExams = async (instituteId, studentId) => {
  const student = await User.findByPk(studentId);
  if (!student) throw new Error('Student not found');

  const studentClass = student.details?.class_id;
  const studentSection = student.details?.section_id;

  const where = {
    school_id: instituteId,
    'entity_ids.class_id': studentClass,
    status: { [Op.in]: ['scheduled', 'ongoing'] }
  };

  if (studentSection) {
    where['entity_ids.section_id'] = studentSection;
  }

  const exams = await Exam.findAll({
    where,
    order: [['start_date', 'ASC']]
  });

  const now = new Date();
  const upcoming = exams.filter(e => new Date(e.start_date) > now);
  const ongoing = exams.filter(e => new Date(e.start_date) <= now && new Date(e.end_date) >= now);
  
  const completed = await Exam.findAll({
    where: {
      school_id: instituteId,
      'entity_ids.class_id': studentClass,
      ...(studentSection && { 'entity_ids.section_id': studentSection }),
      status: 'completed'
    },
    order: [['end_date', 'DESC']],
    limit: 5
  });

  const completedWithResults = await Promise.all(completed.map(async (exam) => {
    const result = await ExamResult.findOne({
      where: { exam_id: exam.id, student_id: studentId }
    });
    return {
      ...exam.toJSON(),
      result_status: result ? 'published' : 'pending'
    };
  }));

  return { upcoming, ongoing, completed: completedWithResults };
};

/**
 * Get student's results
 */
export const getStudentResults = async (instituteId, studentId) => {
  const results = await ExamResult.findAll({
    where: { student_id: studentId },
    include: [{ model: Exam, as: 'exam', where: { school_id: instituteId } }],
    order: [['created_at', 'DESC']]
  });

  return results.map(result => ({
    exam_id: result.exam_id,
    exam_name: result.exam.name,
    exam_type: result.exam.type,
    percentage: result.percentage,
    grade: result.grade,
    rank: result.rank,
    status: result.status,
    result_date: result.exam.publish_results_date || result.updated_at
  }));
};

/**
 * Get exam options for dropdown
 */
export const getExamOptions = async (filters = {}) => {
  const where = { school_id: filters.institute_id };

  if (filters.academic_year_id) where.academic_year_id = filters.academic_year_id;
  if (filters.class_id) where['entity_ids.class_id'] = filters.class_id;
  if (filters.section_id) where['entity_ids.section_id'] = filters.section_id;
  if (filters.status) where.status = filters.status;

  const exams = await Exam.findAll({
    where,
    attributes: ['id', 'name', 'type', 'start_date', 'status'],
    order: [['start_date', 'DESC']],
    limit: 100
  });

  return exams.map(exam => ({
    value: exam.id,
    label: `${exam.name} (${exam.type})`,
    type: exam.type,
    start_date: exam.start_date,
    status: exam.status
  }));
};

export default {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  updateExamStatus,
  publishExam,
  addExamResults,
  getExamResults,
  updateExamResult,
  deleteExamResult,
  publishExamResults,
  exportExamResults,
  getExamAnalytics,
  generateGradeSheet,
  getStudentExams,
  getStudentResults,
  getExamOptions
};