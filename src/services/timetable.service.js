
// backend/src/services/timetable.service.js

/**
 * The Clouds Academy - Timetable Service
 * 
 * Yeh service timetable ki saari business logic handle karta hai:
 * - Entities fetch karna (classes, sections, teachers, etc.)
 * - Timetable create/update/delete
 * - Teacher conflict check
 * - Slots management
 * - Days configuration
 */

import models from '../models/postgres/index.js';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const { Timetable, Class, User, Subject, AcademicYear } = models;

/**
 * 1. getTimetableEntities(instituteId, academicYearId)
 * ----------------------------------------------------
 * Yeh function saari entities fetch karta hai dropdown ke liye:
 * - Academic Years
 * - Classes (with their sections from JSONB)
 * - Teachers (user_type = 'TEACHER')
 * - Subjects (from Class.courses JSONB)
 * - Courses, Batches, Programs, Departments, Semesters
 */
export const getTimetableEntities = async (instituteId, academicYearId, branchId = null) => {
  // console.log('📋 Entities fetch ho rahi hain institute:', instituteId);

  const entities = {};

  const academicYearWhere = { institute_id: instituteId };
  if (branchId) {
    academicYearWhere.branch_id = branchId;
  }

  // 1. Academic Years fetch karo
  entities.academicYears = await AcademicYear.findAll({
    where: academicYearWhere,
    attributes: ['id', 'name', 'start_date', 'end_date', 'is_current'],
    order: [['start_date', 'DESC']]
  });

  const classWhere = { school_id: instituteId, is_active: true };
  if (branchId) {
    classWhere.branch_id = branchId;
  }

  // 2. Classes fetch karo with their sections (JSONB se)
  const classes = await Class.findAll({
    where: classWhere,
    attributes: ['id', 'name', 'sections', 'courses'],
    order: [['name', 'ASC']]
  });

  // Classes ko transform karo
  entities.classes = classes.map(c => ({
    id: c.id,
    name: c.name,
    sections: (c.sections || []).map(s => ({
      id: s.id,
      name: s.name,
      room_no: s.room_no
    }))
  }));

  const teacherWhere = { school_id: instituteId, user_type: 'TEACHER', is_active: true };
  if (branchId) {
    teacherWhere.branch_id = branchId;
  }

  // 3. Teachers fetch karo
  entities.teachers = await User.findAll({
    where: teacherWhere,
    attributes: ['id', 'first_name', 'last_name'],
    order: [['first_name', 'ASC']]
  });

  // 4. Subjects extract karo classes ke courses se
  const subjectsMap = new Map();
  classes.forEach(c => {
    (c.courses || []).forEach(course => {
      (course.materials || []).forEach(m => {
        if (m.subject_name) {
          const key = m.subject_name;
          if (!subjectsMap.has(key)) {
            subjectsMap.set(key, {
              id: m.subject_id || key,
              name: m.subject_name
            });
          }
        }
      });
    });
  });
  entities.subjects = Array.from(subjectsMap.values());

  // 5. Coaching entities (courses, batches)
  try {
    const { Course, Batch } = models;
    entities.courses = await Course.findAll({
      where: { school_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'code']
    });
    entities.batches = await Batch.findAll({
      where: { school_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'code', 'course_id']
    });
  } catch (error) {
    console.log('⚠️ Course/Batch models nahi mile, skip kar rahe hain');
    entities.courses = [];
    entities.batches = [];
  }

  // 6. College/University entities (departments, programs, semesters)
  try {
    const { Department, Program, Semester } = models;
    entities.departments = await Department.findAll({
      where: { school_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'code']
    });
    entities.programs = await Program.findAll({
      where: { school_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'code', 'department_id']
    });
    entities.semesters = await Semester.findAll({
      where: { school_id: instituteId, is_active: true },
      attributes: ['id', 'name', 'semester_no', 'program_id']
    });
  } catch (error) {
    console.log('⚠️ Department/Program/Semester models nahi mile, skip kar rahe hain');
    entities.departments = [];
    entities.programs = [];
    entities.semesters = [];
  }

  console.log('✅ Entities fetch ho gayin');
  return entities;
};

/**
 * 2. createTimetable(data)
 * ------------------------
 * Naya timetable banata hai
 */
export const createTimetable = async (data, options = {}) => {
  const { transaction } = options;

  // console.log('📝 Naya timetable create ho raha hai:', data.name);

  // Pehle check karo ke is entity ke liye already active timetable to nahi hai
  const existing = await Timetable.findOne({
    where: {
      school_id: data.school_id,
      academic_year_id: data.academic_year_id,
      entity_type: data.entity_type,
      entity_ids: data.entity_ids,
      is_active: true
    }
  });

  if (existing) {
    throw new Error('⚠️ Is entity ke liye already ek active timetable maujood hai');
  }

  // Period config validate karo
  if (!data.period_config || !data.period_config.periods) {
    throw new Error('⚠️ Period configuration zaroori hai');
  }

  // Har period mein type check karo (study ya break)
  const validatedPeriods = data.period_config.periods.map(p => ({
    ...p,
    type: p.type || (p.is_break ? 'break' : 'study')
  }));

  // ✅ FIX: Days ko properly save karo
  const period_config = {
    total_periods: data.period_config.total_periods || validatedPeriods.length,
    periods: validatedPeriods,
    breaks: data.period_config.breaks || [],
    days: data.period_config.days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    days_count: data.period_config.days?.length || 5
  };

  // Slots create karo agar diye gaye hain
  const slots = (data.slots || []).map(slot => ({
    id: uuidv4(),
    day: slot.day,
    period: slot.period,
    start_time: slot.start_time,
    end_time: slot.end_time,
    subject_id: slot.subject_id || null,
    subject_name: slot.subject_name || '',
    teacher_id: slot.teacher_id || null,
    teacher_name: slot.teacher_name || '',
    room_no: slot.room_no || '',
    is_break: slot.is_break || false,
    break_name: slot.break_name || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Timetable create karo
  const timetable = await Timetable.create({
    id: uuidv4(),
    school_id: data.school_id,
    branch_id: data.branch_id || null,
    academic_year_id: data.academic_year_id,
    entity_type: data.entity_type,
    entity_ids: data.entity_ids,
    name: data.name,
    description: data.description || '',
    effective_from: data.effective_from || new Date(),
    effective_to: data.effective_to || null,
    is_active: data.is_active !== false,
    period_config,
    slots,
    created_by: data.created_by,
    updated_by: data.created_by,
    created_at: new Date(),
    updated_at: new Date()
  }, { transaction });

  // console.log('✅ Timetable create ho gaya:', timetable.id);
  return timetable;
};

/**
 * 3. updateTimetable(id, instituteId, updateData)
 * ------------------------------------------------
 * Timetable update karta hai
 */
export const updateTimetable = async (id, instituteId, updateData, options = {}) => {
  const { transaction } = options;

  // console.log('📝 Timetable update ho raha hai:', id);

  const where = { id, school_id: instituteId };
  if (updateData.branch_id) {
    where.branch_id = updateData.branch_id;
  }

  const timetable = await Timetable.findOne({
    where
  });

  if (!timetable) {
    throw new Error('❌ Timetable nahi mila');
  }

  // Basic fields update karo
  const basicFields = ['name', 'description', 'effective_from', 'effective_to', 'is_active'];
  basicFields.forEach(field => {
    if (updateData[field] !== undefined) {
      timetable[field] = updateData[field];
    }
  });

  // ✅ FIX: Period config update karo agar diya gaya ho (with days)
  if (updateData.period_config) {
    const validatedPeriods = updateData.period_config.periods.map(p => ({
      ...p,
      type: p.type || (p.is_break ? 'break' : 'study')
    }));

    timetable.period_config = {
      total_periods: updateData.period_config.total_periods || validatedPeriods.length,
      periods: validatedPeriods,
      breaks: updateData.period_config.breaks || [],
      // ✅ IMPORTANT: Days ko bhi update karo
      days: updateData.period_config.days || timetable.period_config?.days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      days_count: updateData.period_config.days?.length || timetable.period_config?.days?.length || 5
    };
    timetable.changed('period_config', true);
  }

  // ✅ FIX: Slots update karte waqt invalid days remove karo
  if (updateData.slots !== undefined) {
    const existingSlots = timetable.slots || [];
    const existingMap = {};
    existingSlots.forEach(s => { existingMap[s.id] = s; });

    // Active days ki list
    const activeDays = timetable.period_config?.days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    const updatedSlots = updateData.slots
      .filter(slot => activeDays.includes(slot.day)) // Sirf active days ke slots rakho
      .map(slot => {
        if (slot.id && existingMap[slot.id]) {
          // Existing slot update karo
          return {
            ...existingMap[slot.id],
            day: slot.day ?? existingMap[slot.id].day,
            period: slot.period ?? existingMap[slot.id].period,
            start_time: slot.start_time ?? existingMap[slot.id].start_time,
            end_time: slot.end_time ?? existingMap[slot.id].end_time,
            subject_id: slot.subject_id ?? existingMap[slot.id].subject_id,
            subject_name: slot.subject_name ?? existingMap[slot.id].subject_name,
            teacher_id: slot.teacher_id ?? existingMap[slot.id].teacher_id,
            teacher_name: slot.teacher_name ?? existingMap[slot.id].teacher_name,
            room_no: slot.room_no ?? existingMap[slot.id].room_no,
            is_break: slot.is_break ?? existingMap[slot.id].is_break,
            break_name: slot.break_name ?? existingMap[slot.id].break_name,
            updated_at: new Date().toISOString()
          };
        } else {
          // Naya slot
          return {
            id: slot.id || uuidv4(),
            day: slot.day,
            period: slot.period,
            start_time: slot.start_time,
            end_time: slot.end_time,
            subject_id: slot.subject_id || null,
            subject_name: slot.subject_name || '',
            teacher_id: slot.teacher_id || null,
            teacher_name: slot.teacher_name || '',
            room_no: slot.room_no || '',
            is_break: slot.is_break || false,
            break_name: slot.break_name || null,
            created_at: slot.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
      });

    timetable.slots = updatedSlots;
    timetable.changed('slots', true);
  }

  timetable.updated_at = new Date();
  timetable.updated_by = updateData.updated_by || timetable.updated_by;

  await timetable.save({ transaction });

  // console.log('✅ Timetable update ho gaya:', timetable.id);
  return timetable;
};

/**
 * 4. getAllTimetables(filters, pagination)
 * -----------------------------------------
 * Saare timetables fetch karta hai filters ke saath
 */
export const getAllTimetables = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  // console.log('📋 Timetables fetch ho rahe hain, page:', page);

  const where = { school_id: filters.institute_id };

  if (filters.branch_id) {
    where.branch_id = filters.branch_id;
  }

  if (filters.academic_year_id) {
    where.academic_year_id = filters.academic_year_id;
  }

  if (filters.entity_type) {
    where.entity_type = filters.entity_type;
  }

  // JSONB fields par filter
  if (filters.class_id) {
    where['entity_ids.class_id'] = filters.class_id;
  }
  if (filters.section_id) {
    where['entity_ids.section_id'] = filters.section_id;
  }
  if (filters.course_id) {
    where['entity_ids.course_id'] = filters.course_id;
  }
  if (filters.batch_id) {
    where['entity_ids.batch_id'] = filters.batch_id;
  }
  if (filters.department_id) {
    where['entity_ids.department_id'] = filters.department_id;
  }
  if (filters.program_id) {
    where['entity_ids.program_id'] = filters.program_id;
  }
  if (filters.semester_id) {
    where['entity_ids.semester_id'] = filters.semester_id;
  }

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active === 'true';
  }

  const { count, rows } = await Timetable.findAndCountAll({
    where,
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name'] }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  // console.log(`✅ ${rows.length} timetables mile`);

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

/**
 * 5. getTimetableById(id, instituteId)
 * -------------------------------------
 * Ek timetable ki details fetch karta hai
 */
export const getTimetableById = async (id, instituteId, branchId = null) => {
  // console.log('🔍 Timetable dhond rahe hain:', id);

  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;

  const timetable = await Timetable.findOne({
    where,
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name'] }
    ]
  });

  if (!timetable) {
    return null;
  }

  return timetable;
};

/**
 * 6. deleteTimetable(id, instituteId)
 * ------------------------------------
 * Timetable delete karta hai
 */
export const deleteTimetable = async (id, instituteId, branchId = null) => {
  // console.log('🗑️ Timetable delete ho raha hai:', id);

  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;

  const timetable = await Timetable.findOne({
    where
  });

  if (!timetable) {
    throw new Error('❌ Timetable nahi mila');
  }

  await timetable.destroy();

  // console.log('✅ Timetable delete ho gaya');
  return { message: 'Timetable delete ho gaya' };
};

/**
 * 7. toggleTimetableStatus(id, instituteId, isActive)
 * ----------------------------------------------------
 * Timetable ko activate/deactivate karta hai
 */
export const toggleTimetableStatus = async (id, instituteId, isActive, branchId = null) => {
  // console.log('🔄 Timetable status change ho raha hai:', id, 'to:', isActive);

  const where = { id, school_id: instituteId };
  if (branchId) where.branch_id = branchId;

  const timetable = await Timetable.findOne({
    where
  });

  if (!timetable) {
    throw new Error('❌ Timetable nahi mila');
  }

  timetable.is_active = isActive;
  timetable.updated_at = new Date();
  await timetable.save();

  // console.log('✅ Timetable status change ho gaya');
  return timetable;
};


// /**
//  * 8. checkTeacherConflict(instituteId, teacherId, day, period, startTime, endTime, excludeId)
//  * ------------------------------------------------------------------------------------------
//  * Check karta hai ke teacher already busy to nahi hai
//  */
// export const checkTeacherConflict = async (instituteId, teacherId, day, period, startTime, endTime, excludeId = null) => {
//   console.log('🔍 Teacher conflict check ho raha hai:', { teacherId, day, period });

//   const timetables = await Timetable.findAll({
//     where: {
//       school_id: instituteId,
//       is_active: true
//     }
//   });

//   for (const timetable of timetables) {
//     const conflict = (timetable.slots || []).some(slot => 
//       slot.teacher_id === teacherId &&
//       slot.day === day &&
//       slot.id !== excludeId &&
//       (
//         // Period number se match
//         (period && slot.period === period) ||
//         // Ya time range se match (agar periods flexible hain)
//         (startTime && endTime && slot.start_time && slot.end_time &&
//           ((startTime >= slot.start_time && startTime < slot.end_time) ||
//            (endTime > slot.start_time && endTime <= slot.end_time) ||
//            (startTime <= slot.start_time && endTime >= slot.end_time)))
//       )
//     );

//     if (conflict) {
//       console.log('⚠️ Teacher conflict milli');
//       return true;
//     }
//   }

//   console.log('✅ Teacher conflict nahi milli');
//   return false;
// };

// backend/src/services/timetable.service.js

/**
 * 8. getBusyTeachers(instituteId, day, period, startTime, endTime, excludeTimetableId, classId, sectionId)
 * ---------------------------------------------------------------------------------------------------------
 * Specific day aur period ke liye busy teachers fetch karta hai
 * Agar koi teacher already kisi class mein busy hai to woh yahan aayega
 */
export const getBusyTeachers = async (instituteId, day, period, startTime, endTime, excludeTimetableId, classId, sectionId, branchId = null) => {
  // console.log('🔍 Busy teachers fetch ho rahe hain:', { day, period, classId, sectionId });

  const where = {
    school_id: instituteId,
    is_active: true
  };
  if (branchId) where.branch_id = branchId;

  // Active timetables fetch karo
  const timetables = await Timetable.findAll({
    where,
    include: [
      { model: AcademicYear, as: 'academicYear', attributes: ['id', 'name', 'is_current'] }
    ]
  });

  const busyTeacherIds = new Set();
  const busyTeacherDetails = [];

  for (const timetable of timetables) {
    // Current timetable ko exclude karo (edit mode mein)
    if (excludeTimetableId && timetable.id === excludeTimetableId) {
      continue;
    }

    const slots = timetable.slots || [];
    
    for (const slot of slots) {
      // Sirf study slots check karo (breaks nahi)
      if (slot.is_break) continue;

      // Same day check karo
      if (slot.day !== day) continue;

      let isConflict = false;

      // Period number se check
      if (period && slot.period === parseInt(period)) {
        isConflict = true;
      }
      // Time range se check
      else if (startTime && endTime && slot.start_time && slot.end_time) {
        if ((startTime >= slot.start_time && startTime < slot.end_time) ||
            (endTime > slot.start_time && endTime <= slot.end_time) ||
            (startTime <= slot.start_time && endTime >= slot.end_time)) {
          isConflict = true;
        }
      }

      if (isConflict && slot.teacher_id) {
        busyTeacherIds.add(slot.teacher_id);
        
        // Additional info store karo
        busyTeacherDetails.push({
          teacher_id: slot.teacher_id,
          teacher_name: slot.teacher_name,
          class_name: timetable.name,
          period: slot.period,
          subject: slot.subject_name,
          day: slot.day
        });
      }
    }
  }

  // Agar class_id aur section_id diya hai to same class ke teachers ko check karo
  if (classId && sectionId) {
    // Is class/section ka active timetable dekho
    const currentClassTimetable = timetables.find(t => 
      t.entity_ids?.class_id === classId && 
      t.entity_ids?.section_id === sectionId
    );

    if (currentClassTimetable) {
      const slots = currentClassTimetable.slots || [];
      for (const slot of slots) {
        if (slot.day === day && !slot.is_break) {
          if ((period && slot.period === parseInt(period)) ||
              (startTime && endTime && slot.start_time && slot.end_time &&
               ((startTime >= slot.start_time && startTime < slot.end_time) ||
                (endTime > slot.start_time && endTime <= slot.end_time)))) {
            busyTeacherIds.add(slot.teacher_id);
            busyTeacherDetails.push({
              teacher_id: slot.teacher_id,
              teacher_name: slot.teacher_name,
              class_name: currentClassTimetable.name,
              period: slot.period,
              subject: slot.subject_name,
              day: slot.day,
              is_same_class: true
            });
          }
        }
      }
    }
  }

  console.log(`✅ ${busyTeacherIds.size} busy teachers mile`);
  
  return Array.from(busyTeacherIds);
};

// Update checkTeacherConflict function
export const checkTeacherConflict = async (instituteId, teacherId, day, period, startTime, endTime, excludeId = null, branchId = null) => {
  console.log('🔍 Teacher conflict check ho raha hai:', { teacherId, day, period });

  const where = {
    school_id: instituteId,
    is_active: true
  };
  if (branchId) where.branch_id = branchId;

  const timetables = await Timetable.findAll({
    where
  });

  for (const timetable of timetables) {
    const conflict = (timetable.slots || []).some(slot => 
      slot.teacher_id === teacherId &&
      slot.day === day &&
      !slot.is_break &&
      slot.id !== excludeId &&
      (
        // Period number se match
        (period && slot.period === parseInt(period)) ||
        // Ya time range se match (agar periods flexible hain)
        (startTime && endTime && slot.start_time && slot.end_time &&
          ((startTime >= slot.start_time && startTime < slot.end_time) ||
           (endTime > slot.start_time && endTime <= slot.end_time) ||
           (startTime <= slot.start_time && endTime >= slot.end_time)))
      )
    );

    if (conflict) {
      console.log('⚠️ Teacher conflict milli');
      return true;
    }
  }

  console.log('✅ Teacher conflict nahi milli');
  return false;
};

/**
 * 9. validateTimetableDays(timetable)
 * ------------------------------------
 * Validate karta hai ke saare slots active days mein hain
 */
export const validateTimetableDays = async (id, instituteId) => {
  const timetable = await Timetable.findOne({
    where: { id, school_id: instituteId }
  });

  if (!timetable) {
    throw new Error('❌ Timetable nahi mila');
  }

  const activeDays = timetable.period_config?.days || [];
  const invalidSlots = (timetable.slots || []).filter(slot => 
    !activeDays.includes(slot.day)
  );

  if (invalidSlots.length > 0) {
    console.log(`⚠️ ${invalidSlots.length} slots invalid days mein hain`);
  }

  return {
    valid: invalidSlots.length === 0,
    invalidSlots,
    activeDays
  };
};

// Export karna mat bhoolna
export default {
  getTimetableEntities,
  createTimetable,
  updateTimetable,
  getAllTimetables,
  getTimetableById,
  deleteTimetable,
  toggleTimetableStatus,
  checkTeacherConflict,
  getBusyTeachers,  // <-- Naya function export
  validateTimetableDays
};


// export default {
//   getTimetableEntities,
//   createTimetable,
//   updateTimetable,
//   getAllTimetables,
//   getTimetableById,
//   deleteTimetable,
//   toggleTimetableStatus,
//   checkTeacherConflict,
//   validateTimetableDays
// };