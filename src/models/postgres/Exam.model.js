// // backend/src/models/Exam.js

// /**
//  * The Clouds Academy - Enhanced Exam Model
//  */

// import { DataTypes } from 'sequelize';
// import sequelize from '../../config/database.js';

// const Exam = sequelize.define(
//   'Exam',
//   {
//     id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
//     school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
//     branch_id: {
//       type: DataTypes.UUID,
//       allowNull: true,
//       references: { model: 'branches', key: 'id' },
//       comment: 'Branch specific exam'
//     },
    
//     // Entity Type
//     entity_type: {
//       type: DataTypes.ENUM('school', 'coaching', 'tuition_center', 'academy', 'college'),
//       allowNull: false,
//       defaultValue: 'school',
//     },
    
//     // Flexible entity IDs
//     entity_ids: {
//       type: DataTypes.JSONB,
//       defaultValue: {},
//       comment: `Flexible entity IDs: { class_id, section_id, subject_id } etc.`
//     },
    
//     academic_year_id: {
//       type: DataTypes.UUID,
//       allowNull: true,
//       references: { model: 'academic_years', key: 'id' }
//     },
    
//     // Exam Details
//     name: { type: DataTypes.STRING(200), allowNull: false },
//     code: { type: DataTypes.STRING(50) },
    
//     type: {
//       type: DataTypes.ENUM(
//         'mid_term', 'final', 'unit_test', 'monthly', 'weekly', 
//         'quarterly', 'half_yearly', 'annual', 'entrance', 'practice', 'other'
//       ),
//       defaultValue: 'other'
//     },
    
//     category: {
//       type: DataTypes.ENUM('theory', 'practical', 'viva', 'assignment', 'project', 'combined'),
//       defaultValue: 'theory'
//     },
    
//     // Dates
//     start_date: { type: DataTypes.DATEONLY, allowNull: false },
//     end_date: { type: DataTypes.DATEONLY, allowNull: false },
//     start_time: { type: DataTypes.TIME },
//     end_time: { type: DataTypes.TIME },
//     duration_minutes: { type: DataTypes.INTEGER },
    
//     // Marks Configuration
//     total_marks: { type: DataTypes.INTEGER, defaultValue: 100 },
//     pass_marks: { type: DataTypes.INTEGER },
//     pass_percentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 40 },
    
//     // Subject wise marks distribution
//     subjects_config: {
//       type: DataTypes.JSONB,
//       defaultValue: [],
//       comment: `[{ subject_id, subject_name, total_marks, pass_marks, weightage }]`
//     },
    
//     // Section wise schedule
//     schedules: {
//       type: DataTypes.JSONB,
//       defaultValue: [],
//       comment: `[{ section_id, section_name, date, start_time, end_time, venue }]`
//     },
    
//     // Venue
//     venue: { type: DataTypes.STRING(200) },
//     room_no: { type: DataTypes.STRING(50) },
    
//     // Status
//     status: {
//       type: DataTypes.ENUM('draft', 'scheduled', 'ongoing', 'completed', 'cancelled', 'results_published'),
//       defaultValue: 'draft'
//     },
//     is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
//     publish_results_date: { type: DataTypes.DATEONLY },
    
//     // 🔥 OPTIONAL: Exam attendance flag
//     track_attendance: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//       comment: 'Whether to track attendance for this exam (optional)'
//     },
    
//     // Grading System
//     grading_system: {
//       type: DataTypes.JSONB,
//       defaultValue: {
//         system: 'percentage',
//         grades: [
//           { min: 90, max: 100, grade: 'A+', gpa: 4.0, remarks: 'Excellent' },
//           { min: 80, max: 89, grade: 'A', gpa: 3.7, remarks: 'Very Good' },
//           { min: 70, max: 79, grade: 'B', gpa: 3.0, remarks: 'Good' },
//           { min: 60, max: 69, grade: 'C', gpa: 2.5, remarks: 'Satisfactory' },
//           { min: 50, max: 59, grade: 'D', gpa: 2.0, remarks: 'Pass' },
//           { min: 0, max: 49, grade: 'F', gpa: 0, remarks: 'Fail' }
//         ]
//       }
//     },
    
//     // Settings
//     settings: {
//       type: DataTypes.JSONB,
//       defaultValue: {
//         allow_negative_marking: false,
//         allow_partial_marking: true,
//         show_result_immediately: false,
//         require_teacher_approval: true,
//         allow_retake: false,
//         max_retakes: 0,
//         question_types: ['mcq', 'theory', 'practical']
//       }
//     },
    
//     // Attachments
//     attachments: {
//       type: DataTypes.JSONB,
//       defaultValue: [],
//       comment: 'Question papers, answer keys, etc.'
//     },
    
//     // Audit
//     created_by: { type: DataTypes.UUID },
//     updated_by: { type: DataTypes.UUID },
//     created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
//     updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
//   },
//   {
//     tableName: 'exams',
//     timestamps: true,
//     createdAt: 'created_at',
//     updatedAt: 'updated_at',
//     indexes: [
//       { fields: ['school_id'] },
//       { fields: ['entity_type'] },
//       { fields: ['entity_ids'], using: 'gin' },
//       { fields: ['academic_year_id'] },
//       { fields: ['status'] },
//       { fields: ['start_date', 'end_date'] }
//     ]
//   }
// );

// Exam.associate = (models) => {
//   Exam.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
//   Exam.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academicYear' });
//   Exam.hasMany(models.ExamResult, { foreignKey: 'exam_id', as: 'results' });
//   // Optional: Link to StudentAttendance for exam attendance
//   Exam.hasMany(models.StudentAttendance, { 
//     foreignKey: 'exam_id', 
//     as: 'examAttendance',
//     constraints: false,
//     scope: { type: 'exam' }
//   });
// };

// export default Exam;




// backend/src/models/Exam.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Exam = sequelize.define(
  'Exam',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    school_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' }
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' }
    },
    
    // ==================== ENTITY CONFIGURATION ====================
    entity_type: {
      type: DataTypes.ENUM('school', 'coaching', 'tuition_center', 'academy', 'college'),
      allowNull: false,
      defaultValue: 'school'
    },
    
    // 🔥 CRITICAL: Class ID as separate column (NOT in JSON)
    class_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'classes', key: 'id' },
      comment: 'Class for which this exam is created'
    },
    
    // Section ID - Optional, can be null for whole class
    section_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'sections', key: 'id' },
      comment: 'Optional: Specific section, null means all sections'
    },
    
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'academic_years', key: 'id' }
    },
    
    // ==================== BASIC EXAM INFO ====================
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { len: [3, 200] }
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // ==================== EXAM TYPE & CATEGORY ====================
    type: {
      type: DataTypes.ENUM(
        'mid_term', 'final', 'unit_test', 'monthly', 'weekly',
        'quarterly', 'half_yearly', 'annual', 'entrance', 
        'practice', 'quiz', 'assignment', 'other'
      ),
      defaultValue: 'other'
    },
    category: {
      type: DataTypes.ENUM('theory', 'practical', 'viva', 'assignment', 'project', 'combined'),
      defaultValue: 'theory'
    },
    
    // ==================== 🔥 CORE: SUBJECT-WISE SCHEDULE ====================
    subject_schedules: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidSchedule(value) {
          if (!Array.isArray(value)) throw new Error('subject_schedules must be an array');
          
          // Check for duplicate subjects
          const subjectIds = value.map(s => s.subject_id).filter(id => id);
          if (subjectIds.length !== new Set(subjectIds).size) {
            throw new Error('Duplicate subjects found in schedule');
          }
        }
      },
      comment: `[
        {
          subject_id: "uuid",
          subject_name: "Mathematics",
          subject_code: "MATH101",
          date: "2024-03-15",
          start_time: "09:00:00",
          end_time: "12:00:00",
          duration_minutes: 180,
          total_marks: 100,
          pass_marks: 40,
          venue: "Main Hall",
          room_no: "101",
          invigilator_ids: ["teacher_id_1", "teacher_id_2"],
          instructions: "Use blue pen only"
        }
      ]`
    },
    
    // ==================== AUTO-CALCULATED DATES ====================
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Auto-calculated from subject_schedules (minimum date)"
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Auto-calculated from subject_schedules (maximum date)"
    },
    
    // ==================== AGGREGATED MARKS (Auto-calculated) ====================
    total_marks: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Auto-calculated sum of subject_schedules.total_marks"
    },
    pass_marks: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Auto-calculated based on pass_percentage"
    },
    pass_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 40
    },
    
    // ==================== GRADING SYSTEM ====================
    grading_system: {
      type: DataTypes.JSONB,
      defaultValue: {
        system: 'percentage',
        grades: [
          { min: 90, max: 100, grade: 'A+', gpa: 4.0, remarks: 'Excellent' },
          { min: 80, max: 89, grade: 'A', gpa: 3.7, remarks: 'Very Good' },
          { min: 70, max: 79, grade: 'B', gpa: 3.0, remarks: 'Good' },
          { min: 60, max: 69, grade: 'C', gpa: 2.5, remarks: 'Satisfactory' },
          { min: 50, max: 59, grade: 'D', gpa: 2.0, remarks: 'Pass' },
          { min: 0, max: 49, grade: 'F', gpa: 0, remarks: 'Fail' }
        ]
      }
    },
    
    // ==================== STATUS & PUBLISHING ====================
    status: {
      type: DataTypes.ENUM(
        'draft', 'scheduled', 'ongoing', 'completed', 
        'cancelled', 'results_published', 'archived'
      ),
      defaultValue: 'draft'
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    publish_results_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    
    // ==================== SETTINGS ====================
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        allow_negative_marking: false,
        allow_partial_marking: true,
        show_result_immediately: false,
        require_teacher_approval: true,
        allow_retake: false,
        max_retakes: 0,
        track_attendance: true,
        result_format: 'percentage',
        question_types: ['mcq', 'theory', 'practical']
      }
    },
    
    // ==================== ATTACHMENTS ====================
    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: '[{ type: "question_paper", url: "s3://...", uploaded_by: "user_id" }]'
    },
    
    // ==================== RESULTS SUMMARY (Cached) ====================
    results_summary: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Cached summary: { total_students, passed, failed, absent, average_percentage, highest_percentage }'
    },
    
    // ==================== AUDIT FIELDS ====================
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'exams',
    paranoid: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['school_id'] },
      { fields: ['class_id'] },           // 🔥 Index on class_id
      { fields: ['section_id'] },         // Index on section_id (optional)
      { fields: ['academic_year_id'] },
      { fields: ['status'] },
      { fields: ['type'] },
      { fields: ['start_date', 'end_date'] },
      { fields: ['subject_schedules'], using: 'gin' },
      { fields: ['deleted_at'] },
      // Composite indexes for common queries
      { fields: ['school_id', 'class_id'] },
      { fields: ['school_id', 'status'] },
      { fields: ['class_id', 'status'] }
    ],
    
    hooks: {
      beforeValidate: (exam) => {
        if (exam.subject_schedules?.length) {
          // Auto-calculate dates
          const dates = exam.subject_schedules
            .map(s => s.date)
            .filter(d => d);
          
          if (dates.length) {
            exam.start_date = dates.reduce((min, d) => d < min ? d : min, dates[0]);
            exam.end_date = dates.reduce((max, d) => d > max ? d : max, dates[0]);
          }
          
          // Auto-calculate total marks
          exam.total_marks = exam.subject_schedules.reduce(
            (sum, s) => sum + (parseInt(s.total_marks) || 0), 0
          );
          
          // Auto-calculate pass marks
          if (exam.pass_percentage) {
            exam.pass_marks = Math.round((exam.total_marks * exam.pass_percentage) / 100);
          }
        }
      },
      
      beforeUpdate: async (exam) => {
        exam.updated_at = new Date();
        
        // Generate code if not provided
        if (!exam.code && exam.name) {
          exam.code = `${exam.type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        }
      }
    }
  }
);

// Associations
Exam.associate = (models) => {
  Exam.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  Exam.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
  Exam.belongsTo(models.Section, { foreignKey: 'section_id', as: 'section' });
  Exam.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academicYear' });
  Exam.hasMany(models.ExamResult, { foreignKey: 'exam_id', as: 'results' });
  // ExamAttendance model will be linked when created
};

export default Exam;