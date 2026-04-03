// // /**
// //  * The Clouds Academy - ExamResult Model
// //  */

// // import { DataTypes } from 'sequelize';
// // import sequelize from '../../config/database.js';

// // const ExamResult = sequelize.define(
// //   'ExamResult',
// //   {
// //     id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
// //     school_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'institutes', key: 'id' } },
// //     branch_id: {
// //       type: DataTypes.UUID,
// //       allowNull: true,
// //       references: { model: 'branches', key: 'id' },
// //       onDelete: 'SET NULL',
// //       comment: 'Optional — branch context for this result',
// //     },
// //     exam_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'exams', key: 'id' } },
// //     student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, comment: 'References users table (STUDENT type)' },
// //     subject_id: { type: DataTypes.UUID, references: { model: 'subjects', key: 'id' } },
// //     marks_obtained: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
// //     grade: { type: DataTypes.STRING(5) },
// //     remarks: { type: DataTypes.TEXT },
// //     is_absent: { type: DataTypes.BOOLEAN, defaultValue: false },
// //     entered_by: { type: DataTypes.UUID },
// //   },
// //   { tableName: 'exam_results' }
// // );

// // ExamResult.associate = (models) => {
// //   ExamResult.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
// //   ExamResult.belongsTo(models.Exam, { foreignKey: 'exam_id' });
// //   ExamResult.belongsTo(models.User, { foreignKey: 'student_id', as: 'Student' });
// //   ExamResult.belongsTo(models.Subject, { foreignKey: 'subject_id' });
// // };

// // export default ExamResult;

// // backend/src/models/ExamResult.js

// /**
//  * The Clouds Academy - Exam Result Model
//  */

// import { DataTypes } from 'sequelize';
// import sequelize from '../../config/database.js';

// const ExamResult = sequelize.define(
//   'ExamResult',
//   {
//     id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
//     exam_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'exams', key: 'id' } },
//     student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
    
//     // Subject wise marks
//     subject_marks: {
//       type: DataTypes.JSONB,
//       defaultValue: [],
//       comment: `[{ subject_id, subject_name, marks_obtained, total_marks, percentage, grade, remarks }]`
//     },
    
//     // Aggregated
//     total_marks_obtained: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
//     total_marks: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
//     percentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    
//     // Grade & GPA
//     grade: { type: DataTypes.STRING(5) },
//     gpa: { type: DataTypes.DECIMAL(3, 2) },
//     remarks: { type: DataTypes.TEXT },
    
//     // Rank
//     rank: { type: DataTypes.INTEGER },
//     position: { type: DataTypes.STRING(20) },
    
//     // Status
//     status: {
//       type: DataTypes.ENUM('pass', 'fail', 'absent', 'withheld', 'improvement_required'),
//       defaultValue: 'pass'
//     },
    
//     // Attendance (if tracked separately)
//     is_present: { type: DataTypes.BOOLEAN, defaultValue: true },
//     absent_reason: { type: DataTypes.TEXT },
    
//     // Teacher remarks
//     teacher_remarks: { type: DataTypes.TEXT },
//     approved_by: { type: DataTypes.UUID },
//     approved_at: { type: DataTypes.DATE },
    
//     // Audit
//     created_by: { type: DataTypes.UUID },
//     updated_by: { type: DataTypes.UUID },
//     created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
//     updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
//   },
//   {
//     tableName: 'exam_results',
//     indexes: [
//       { fields: ['exam_id'] },
//       { fields: ['student_id'] },
//       { fields: ['exam_id', 'student_id'], unique: true },
//       { fields: ['rank'] }
//     ]
//   }
// );

// ExamResult.associate = (models) => {
//   ExamResult.belongsTo(models.Exam, { foreignKey: 'exam_id', as: 'exam' });
//   ExamResult.belongsTo(models.User, { foreignKey: 'student_id', as: 'student' });
//   ExamResult.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
// };

// export default ExamResult;




// backend/src/models/ExamResult.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ExamResult = sequelize.define(
  'ExamResult',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'exams', key: 'id' },
      onDelete: 'CASCADE'
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    
    // ==================== SUBJECT-WISE MARKS ====================
    subject_marks: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: `[
        {
          subject_id: "uuid",
          subject_name: "Mathematics",
          marks_obtained: 85,
          total_marks: 100,
          percentage: 85,
          grade: "A",
          gpa: 3.7,
          remarks: "Good"
        }
      ]`
    },
    
    // ==================== AGGREGATED ====================
    total_marks_obtained: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    total_marks: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    
    // ==================== GRADE & RANK ====================
    grade: {
      type: DataTypes.STRING(5),
      allowNull: true
    },
    gpa: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    position: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '1st, 2nd, 3rd, etc.'
    },
    
    // ==================== STATUS ====================
    status: {
      type: DataTypes.ENUM('pass', 'fail', 'absent', 'withheld', 'improvement_required'),
      defaultValue: 'pass'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // ==================== ATTENDANCE ====================
    is_present: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    absent_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // ==================== TEACHER REVIEW ====================
    teacher_remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // ==================== AUDIT ====================
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  },
  {
    tableName: 'exam_results',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false, // Disable soft deletes for ExamResult
    indexes: [
      { fields: ['exam_id'] },
      { fields: ['student_id'] },
      { fields: ['exam_id', 'student_id'], unique: true },
      { fields: ['rank'] },
      { fields: ['status'] }
    ],
    
    hooks: {
      beforeSave: (result) => {
        // Auto-calculate percentage from total_marks_obtained and total_marks
        if (result.total_marks > 0) {
          result.percentage = (result.total_marks_obtained / result.total_marks) * 100;
        }
      }
    }
  }
);

ExamResult.associate = (models) => {
  ExamResult.belongsTo(models.Exam, { foreignKey: 'exam_id', as: 'exam' });
  ExamResult.belongsTo(models.User, { foreignKey: 'student_id', as: 'student' });
  ExamResult.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
};

export default ExamResult;