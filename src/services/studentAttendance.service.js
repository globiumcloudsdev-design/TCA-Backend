import { Op } from "sequelize";
import models from "../models/postgres/index.js";
import { sequelize } from "../models/postgres/index.js";

const { StudentAttendance, User, Class, Section, Institute } = models;

/**
 * Helper: Get active academic session from student details
 */
const getActiveSession = (user) => {
  const studentDetails = user?.details?.studentDetails || {};
  const academicSessions = studentDetails.academicSessions || [];
  const activeSession = academicSessions.find((s) => s.status === "active");

  if (!activeSession) {
    throw new Error("No active academic session found for this student");
  }

  // Return sanitized session with nulls instead of empty strings for UUID fields
  return {
    ...activeSession,
    class_id: activeSession.class_id || null,
    section_id: activeSession.section_id || null,
    academic_year_id: activeSession.academic_year_id || null
  };
};

/**
 * Helper: Get working days in a month (excluding Sundays)
 */
const getWorkingDays = (month, year) => {
  const date = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, month - 1, i);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0) workingDays++;
  }
  return workingDays;
};

/**
 * Helper: Reload attendance record with metadata for display
 */
const reloadAttendanceWithMetadata = async (attendanceId) => {
  const result = await StudentAttendance.findByPk(attendanceId, {
    include: [
      {
        model: User,
        as: "Student",
        attributes: ["id", "first_name", "last_name", "registration_no", "details"],
      },
      { model: Class, attributes: ["id", "name"] },
      { model: Section, as: "Section", attributes: ["id", "name"] },
    ],
  });

  if (!result) return null;

  const json = result.toJSON();
  const studentInfo = json.Student?.details?.studentDetails || json.Student?.details || {};

  // Fallback labels from student details if direct model joins are null (for virtual sections)
  if (!json.Class && studentInfo.class_id) {
    json.Class = { id: studentInfo.class_id, name: studentInfo.class_name || "N/A" };
  }
  if (!json.Section && studentInfo.section_id) {
    json.Section = { id: studentInfo.section_id, name: studentInfo.section_name || "N/A" };
  }

  return json;
};

/**
 * Mark or update attendance (single)
 */
export const markAttendance = async (data, options = {}) => {
  const { transaction, skipReload = false } = options;

  // 1. Fallback to student's active session if class/section info is missing or empty
  if (!data.class_id || !data.section_id || !data.academic_year_id) {
    const student = await User.findByPk(data.student_id, {
      attributes: ["details"],
    });
    if (student) {
      const activeSession = getActiveSession(student);
      data.class_id = data.class_id || activeSession.class_id;
      data.section_id = data.section_id || activeSession.section_id;
      data.academic_year_id = data.academic_year_id || activeSession.academic_year_id;
    }
  }

  // 2. Validate IDs against foreign keys to prevent crashes (PostgreSQL constraint check)
  if (data.class_id) {
    const exists = await Class.findByPk(data.class_id, { attributes: ["id"] });
    if (!exists) data.class_id = null;
  }
  if (data.section_id) {
    const exists = await Section.findByPk(data.section_id, { attributes: ["id"] });
    if (!exists) data.section_id = null;
  }

  // 3. Prepare data
  const sanitizedData = {
    ...data,
    class_id: data.class_id || null,
    section_id: data.section_id || null,
    academic_year_id: data.academic_year_id || null,
  };

  // 4. Save
  const existing = await StudentAttendance.findOne({
    where: { student_id: sanitizedData.student_id, date: sanitizedData.date },
    transaction,
  });

  let attendance;
  if (existing) {
    attendance = await existing.update(sanitizedData, { transaction });
  } else {
    attendance = await StudentAttendance.create(sanitizedData, { transaction });
  }

  // 5. Optionally reload with full metadata for display
  if (skipReload) return attendance;
  return await reloadAttendanceWithMetadata(attendance.id);
};

/**
 * Bulk mark attendance
 */
export const bulkMarkAttendance = async (data, options = {}) => {
  const transaction = await sequelize.transaction();
  try {
    const results = [];
    const errors = [];
    
    // Cache for existence checks to avoid redundant DB calls during bulk operation
    const checkedSections = new Map();
    const checkedClasses = new Map();

    for (const record of data.records) {
      let attendanceData = {
        school_id: data.school_id,
        date: data.date,
        marked_by: data.marked_by,
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks || null,
        type: record.type || data.type || null,
      };

      // Fetch student session info
      const student = await User.findByPk(record.student_id, { attributes: ["details"] });
      if (!student) throw new Error(`Student ${record.student_id} not found`);
      const activeSession = getActiveSession(student);

      // Final IDs with fallback
      attendanceData.class_id = data.class_id || activeSession.class_id;
      attendanceData.section_id = data.section_id || activeSession.section_id;
      attendanceData.academic_year_id = data.academic_year_id || activeSession.academic_year_id;

      // Validation check for Class (cached)
      if (attendanceData.class_id) {
        if (!checkedClasses.has(attendanceData.class_id)) {
          const exists = await Class.findByPk(attendanceData.class_id, { attributes: ["id"] });
          checkedClasses.set(attendanceData.class_id, !!exists);
        }
        if (!checkedClasses.get(attendanceData.class_id)) attendanceData.class_id = null;
      }

      // Validation check for Section (cached)
      if (attendanceData.section_id) {
        if (!checkedSections.has(attendanceData.section_id)) {
          const exists = await Section.findByPk(attendanceData.section_id, { attributes: ["id"] });
          checkedSections.set(attendanceData.section_id, !!exists);
        }
        if (!checkedSections.get(attendanceData.section_id)) attendanceData.section_id = null;
      }

      // Record logic: skip or mark
      let attendance;
      if (data.skip_existing === true) {
        const existing = await StudentAttendance.findOne({
          where: { student_id: attendanceData.student_id, date: attendanceData.date },
          transaction,
        });
        if (existing) {
          errors.push({ student_id: record.student_id, reason: 'Already exists' });
          continue;
        }
        attendance = await StudentAttendance.create(attendanceData, { transaction });
      } else {
        // use internal markAttendance but skip its individual reload
        attendance = await markAttendance(attendanceData, { transaction, skipReload: true });
      }
      results.push(attendance);
    }

    await transaction.commit();

    // Reload ALL results with metadata in parallel at the end
    const finalResults = await Promise.all(
      results.map((r) => reloadAttendanceWithMetadata(r.id))
    );

    return { results: finalResults, skipped: errors.length, errors };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * QR scan attendance
 */
export const scanQR = async (data, options = {}) => {
  const { student_id, date, school_id, marked_by, type } = data;
  const today = date || new Date().toISOString().slice(0, 10);
  const transaction = options.transaction || (await sequelize.transaction());

  try {
    const student = await User.findByPk(student_id, {
      attributes: ["user_type", "details", "school_id"],
    });
    if (!student) throw new Error("Student not found");

    let attendance = await StudentAttendance.findOne({
      where: { student_id, date: today },
      transaction,
    });

    if (attendance && attendance.status === "present") {
      throw new Error(`Attendance already marked as PRESENT for ${today}.`);
    }

    const activeSession = getActiveSession(student);
    const finalSchoolId = school_id || student.school_id;

    if (!attendance) {
      attendance = await StudentAttendance.create({
        student_id,
        school_id: finalSchoolId,
        class_id: activeSession.class_id,
        section_id: activeSession.section_id,
        academic_year_id: activeSession.academic_year_id,
        date: today,
        status: "present",
        type: type || null,
        marked_by,
      }, { transaction });
    } else {
      attendance.status = "present";
      await attendance.save({ transaction });
    }

    if (!options.transaction) await transaction.commit();
    return await reloadAttendanceWithMetadata(attendance.id);
  } catch (err) {
    if (!options.transaction) await transaction.rollback();
    throw err;
  }
};

/**
 * Get attendance records with filters
 */
export const getAttendance = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  const where = {};
  if (filters.school_id) where.school_id = filters.school_id;
  if (filters.class_id) where.class_id = filters.class_id;
  if (filters.section_id) where.section_id = filters.section_id;
  if (filters.student_id) where.student_id = filters.student_id;
  if (filters.date) where.date = filters.date;
  if (filters.from_date && filters.to_date) {
    where.date = { [Op.between]: [filters.from_date, filters.to_date] };
  }
  if (filters.status) where.status = filters.status;

  const { count, rows } = await StudentAttendance.findAndCountAll({
    where,
    include: [
      { model: User, as: "Student", attributes: ["id", "first_name", "last_name", "registration_no", "details"] },
      { model: Class, attributes: ["id", "name"] },
      { model: Section, as: "Section", attributes: ["id", "name"] },
    ],
    order: [["date", "DESC"], ["created_at", "DESC"]],
    limit,
    offset,
  });

  const enhancedRows = rows.map((row) => {
    const json = row.toJSON();
    const studentInfo = json.Student?.details?.studentDetails || json.Student?.details || {};
    
    if (!json.Class && studentInfo.class_id) {
      json.Class = { id: studentInfo.class_id, name: studentInfo.class_name || "N/A" };
    }
    if (!json.Section && studentInfo.section_id) {
      json.Section = { id: studentInfo.section_id, name: studentInfo.section_name || "N/A" };
    }
    return json;
  });

  return {
    data: enhancedRows,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

/**
 * Get attendance report
 */
export const getAttendanceReport = async (params) => {
  const { school_id, class_id, section_id, student_id, month, year } = params;
  const where = { school_id };

  if (class_id) where.class_id = class_id;
  if (section_id) where.section_id = section_id;
  if (student_id) where.student_id = student_id;

  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    where.date = { [Op.between]: [startDate, endDate] };
  } else if (year) {
    where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
  }

  const attendanceRecords = await StudentAttendance.findAll({
    where,
    include: [{ model: User, as: "Student", attributes: ["id", "first_name", "last_name", "registration_no"] }],
  });

  const studentStats = {};
  attendanceRecords.forEach((rec) => {
    const sid = rec.student_id;
    if (!studentStats[sid]) {
      studentStats[sid] = { student: rec.Student, total: 0, present: 0, absent: 0, late: 0, leave: 0, holiday: 0 };
    }
    studentStats[sid].total++;
    if (rec.status === "present") studentStats[sid].present++;
    else if (rec.status === "absent") studentStats[sid].absent++;
    else if (rec.status === "late") studentStats[sid].late++;
    else if (rec.status === "leave") studentStats[sid].leave++;
    else if (rec.status === "holiday") studentStats[sid].holiday++;
  });

  const studentWiseReport = Object.values(studentStats).map((s) => ({
    ...s,
    presentPercentage: s.total ? ((s.present / s.total) * 100).toFixed(2) : 0,
    absentPercentage: s.total ? ((s.absent / s.total) * 100).toFixed(2) : 0,
  }));

  let classSummary = null;
  if (class_id && !section_id && month && year) {
    const totalStudents = await User.count({
      where: {
        school_id, user_type: "STUDENT", is_active: true,
        [Op.and]: sequelize.literal(`details->'studentDetails'->>'class_id' = '${class_id}'`),
      },
    });
    const workingDays = getWorkingDays(month, year);
    let totalPresent = studentWiseReport.reduce((acc, s) => acc + parseInt(s.present), 0);

    classSummary = {
      class_id, month, year, total_students_enrolled: totalStudents,
      working_days: workingDays, total_possible_attendance: totalStudents * workingDays,
      overall_present_percentage: totalStudents * workingDays > 0 ? ((totalPresent / (totalStudents * workingDays)) * 100).toFixed(2) : 0,
    };
  }

  if (student_id && studentWiseReport.length === 1) return studentWiseReport[0];
  return classSummary ? { class_summary: classSummary, student_wise: studentWiseReport } : studentWiseReport;
};

export default {
  markAttendance,
  bulkMarkAttendance,
  scanQR,
  getAttendance,
  getAttendanceReport,
};
