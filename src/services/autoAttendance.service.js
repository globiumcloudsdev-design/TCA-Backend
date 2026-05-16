import cron from "node-cron";
import { Op } from "sequelize";
import { subDays, format } from "date-fns";
import models from "../models/postgres/index.js";
import { sequelize } from "../models/postgres/index.js";

const { StudentAttendance, User, Timetable } = models;

/**
 * Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
const getDayOfWeek = (date) => date.getDay();


/**
 * Check if a given class-section has any class on a specific day of week using the Timetable model
 */
/**
 * Check if a given class-section has any class on a specific day of week using the Timetable model
 */
const hasClassOnDay = async (
  schoolId,
  academicYearId,
  classId,
  sectionId,
  dayOfWeek,
) => {
  // Mapping for day numbers (0-6) to strings used in Timetable
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[dayOfWeek];

  // Fetch all timetables for the school, academic year, entity_type 'school'
  const timetables = await Timetable.findAll({
    where: {
      school_id: schoolId,
      academic_year_id: academicYearId,
      entity_type: "school",
      is_active: true,
    },
    attributes: ["id", "entity_ids", "slots"],
  });

  // Filter by entity_ids matching class_id and section_id
  const matchingTimetable = timetables.find((tt) => {
    const ids = tt.entity_ids;
    return ids && ids.class_id === classId && ids.section_id === sectionId;
  });

  if (!matchingTimetable) return false;

  // Check slots for the day
  const slots = matchingTimetable.slots || [];
  return slots.some((slot) => {
    const slotDay = String(slot.day || '').toLowerCase();
    return slotDay === dayName;
  });
};

/**
 * Main function: auto-mark absent for students who had class but didn't mark attendance
 * @param {string} schoolId - optional, if not provided runs for all active schools
 * @param {string} date - optional, YYYY-MM-DD; defaults to previous day
 */
export const autoMarkAbsent = async (schoolId = null, date = null) => {
  const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const targetDayOfWeek = getDayOfWeek(new Date(targetDate));
  console.log(`🚀 Auto-mark absent for ${targetDate} (day ${targetDayOfWeek})`);

  // Get schools to process
  const schoolWhere = schoolId ? { id: schoolId } : { is_active: true };
  const schools = await models.Institute.findAll({ where: schoolWhere });

  for (const school of schools) {
    console.log(`Processing school: ${school.name} (${school.id})`);

    // 2. Get all active students with their active academic session details
    const students = await User.findAll({
      where: {
        school_id: school.id,
        user_type: "STUDENT",
        is_active: true,
      },
      attributes: ["id", "details", "first_name", "last_name"],
    });

    if (students.length === 0) {
      console.log(`No active students for ${school.name}`);
      continue;
    }

    // 3. Get existing attendance for that date
    const existingAttendance = await StudentAttendance.findAll({
      where: { school_id: school.id, date: targetDate },
      attributes: ["student_id"],
    });
    const existingStudentIds = new Set(
      existingAttendance.map((a) => a.student_id),
    );

    // 4. Group students by (academic_year_id, class_id, section_id) to check timetable once per group
    const groupMap = new Map(); // key = `${academic_year_id}|${class_id}|${section_id}`
    for (const student of students) {
      if (existingStudentIds.has(student.id)) continue; // already marked

      const studentDetails = student.details?.studentDetails || {};
      const academicSessions = studentDetails.academicSessions || [];
      const activeSession = academicSessions.find((s) => s.status === "active");
      if (!activeSession) continue; // no active session

      const { academic_year_id, class_id, section_id } = activeSession;
      if (!class_id) continue; // no class assigned

      const key = `${academic_year_id}|${class_id}|${section_id || "null"}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push({ studentId: student.id, student });
    }

    // 5. For each group, check if class exists on that day
    const studentsToMark = [];
    for (const [key, studentList] of groupMap.entries()) {
      const [academicYearId, classId, sectionIdRaw] = key.split("|");
      const sectionId = sectionIdRaw === "null" ? null : sectionIdRaw;

      const hasClass = await hasClassOnDay(
        school.id,
        academicYearId,
        classId,
        sectionId,
        targetDayOfWeek,
      );

      if (!hasClass) {
        console.log(
          `📅 No class for class ${classId} section ${sectionId} on day ${targetDayOfWeek}, skipping ${studentList.length} students`,
        );
        continue;
      }

      // Mark all these students as absent
      for (const item of studentList) {
        studentsToMark.push({
          student_id: item.studentId,
          student: item.student,
          academicYearId,
          classId,
          sectionId,
        });
      }
    }

    if (studentsToMark.length === 0) {
      console.log(
        `✅ No students to mark absent for ${school.name} on ${targetDate}`,
      );
      continue;
    }

    // 6. Bulk create absent records
    const absentRecords = studentsToMark.map(
      ({ student_id, student, academicYearId, classId, sectionId }) => ({
        school_id: school.id,
        student_id,
        date: targetDate,
        status: "absent",
        remarks: "Auto-marked absent (no attendance recorded)",
        type: "regular",
        marked_by: null,
        class_id: classId,
        section_id: sectionId,
        academic_year_id: academicYearId,
      }),
    );

    try {
      await StudentAttendance.bulkCreate(absentRecords, {
        ignoreDuplicates: true,
      });
      console.log(
        `✅ Marked ${absentRecords.length} students absent for school ${school.name} on ${targetDate}`,
      );
    } catch (error) {
      console.error(
        `❌ Error marking absent for school ${school.name}:`,
        error,
      );
    }
  }

  console.log("🏁 Student auto-mark absent completed.");
};

/**
 * Auto-mark absent for Teachers who had a period but didn't check in
 */
export const autoMarkTeacherAbsent = async (schoolId = null, date = null) => {
  const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const targetDayOfWeek = getDayOfWeek(new Date(targetDate));
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[targetDayOfWeek];

  const where = { is_active: true };
  if (schoolId) where.id = schoolId;
  const institutes = await models.Institute.findAll({ where });

  for (const inst of institutes) {
    // 1. Get all active teachers
    const teachers = await User.findAll({
      where: { school_id: inst.id, user_type: 'TEACHER', is_active: true },
      attributes: ['id', 'first_name', 'last_name', 'branch_id']
    });

    if (teachers.length === 0) continue;

    // 2. Get existing staff attendance
    const existingAttendance = await models.StaffAttendance.findAll({
      where: { institute_id: inst.id, date: targetDate },
      attributes: ['staff_id']
    });
    const markedTeacherIds = new Set(existingAttendance.map(a => a.staff_id));

    // 3. Get all active timetables for the school to find who has classes today
    const timetables = await Timetable.findAll({
      where: { school_id: inst.id, is_active: true },
      attributes: ['slots']
    });

    const teachersWithClassesToday = new Set();
    timetables.forEach(tt => {
      (tt.slots || []).forEach(slot => {
        if (String(slot.day).toLowerCase() === dayName && slot.teacher_id) {
          teachersWithClassesToday.add(slot.teacher_id);
        }
      });
    });

    // 4. Filter teachers who have class today but no attendance record
    const absentees = teachers.filter(t => teachersWithClassesToday.has(t.id) && !markedTeacherIds.has(t.id));

    if (absentees.length === 0) continue;

    // 5. Bulk mark absent
    const records = absentees.map(t => ({
      institute_id: inst.id,
      branch_id: t.branch_id,
      staff_id: t.id,
      date: targetDate,
      status: 'ABSENT',
      remarks: 'Auto-marked absent (No period attendance recorded)',
      marked_at: new Date()
    }));

    try {
      await models.StaffAttendance.bulkCreate(records, { ignoreDuplicates: true });
      console.log(`✅ Marked ${records.length} Teachers absent for institute ${inst.institute_code}`);
    } catch (error) {
      console.error(`❌ Error auto-marking teachers absent for ${inst.institute_code}:`, error);
    }
  }
  console.log("🏁 Teacher auto-mark absent completed.");
};

/**
 * Auto-mark absent for General Staff (not Teachers) based on Weekly Off Days
 */
export const autoMarkStaffAbsent = async (schoolId = null, date = null) => {
  const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const targetDayOfWeek = getDayOfWeek(new Date(targetDate));
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[targetDayOfWeek];

  const where = { is_active: true };
  if (schoolId) where.id = schoolId;
  const institutes = await models.Institute.findAll({ where });

  for (const inst of institutes) {
    // 1. Get institute settings for weekly off days
    const settings = await models.InstituteSettings.findOne({
      where: { institute_id: inst.id }
    });

    // Check timings.weekly_off_days
    const weeklyOffDays = settings?.timings?.weekly_off_days || ['sunday'];
    if (weeklyOffDays.includes(dayName)) {
       console.log(`⏭️ Skipping staff absent marking for ${inst.institute_code} (Weekly Off: ${dayName})`);
       continue;
    }

    // 2. Get all active general staff (exclude Teachers)
    const staff = await User.findAll({
      where: { 
        school_id: inst.id, 
        user_type: 'STAFF', 
        is_active: true 
      },
      attributes: ['id', 'first_name', 'last_name', 'branch_id']
    });

    if (staff.length === 0) continue;

    // 3. Get existing staff attendance
    const existingAttendance = await models.StaffAttendance.findAll({
      where: { institute_id: inst.id, date: targetDate },
      attributes: ['staff_id']
    });
    const markedStaffIds = new Set(existingAttendance.map(a => a.staff_id));

    // 4. Filter absentees
    const absentees = staff.filter(s => !markedStaffIds.has(s.id));

    if (absentees.length === 0) continue;

    // 5. Bulk mark absent
    const records = absentees.map(s => ({
      institute_id: inst.id,
      branch_id: s.branch_id,
      staff_id: s.id,
      date: targetDate,
      status: 'ABSENT',
      remarks: 'Auto-marked absent (No attendance recorded)',
      marked_at: new Date()
    }));

    try {
      await models.StaffAttendance.bulkCreate(records, { ignoreDuplicates: true });
      console.log(`✅ Marked ${records.length} Staff absent for institute ${inst.institute_code}`);
    } catch (error) {
      console.error(`❌ Error auto-marking staff absent for ${inst.institute_code}:`, error);
    }
  }
  console.log("🏁 Staff auto-mark absent completed.");
};

/**
 * Schedule cron job: daily at 00:05 (5 min past midnight)
 * Note: These are also triggered by the system orchestrator job
 */
export const scheduleAutoAttendance = () => {
  cron.schedule("5 0 * * *", async () => {
    console.log("🕛 Running scheduled auto-mark absent for previous day...");
    try {
      const targetDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      await autoMarkAbsent(null, targetDate); // all students
      await autoMarkTeacherAbsent(null, targetDate); // all teachers
      await autoMarkStaffAbsent(null, targetDate); // all general staff
    } catch (error) {
      console.error("❌ Scheduled auto-mark failed:", error);
    }
  });
  console.log("✅ Auto-mark absent cron job scheduled for 00:05 daily");
};

export default { autoMarkAbsent, autoMarkTeacherAbsent, autoMarkStaffAbsent, scheduleAutoAttendance };
