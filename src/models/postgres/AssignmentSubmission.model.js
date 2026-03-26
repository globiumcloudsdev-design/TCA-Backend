// backend/src/models/postgres/AssignmentSubmission.model.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AssignmentSubmission = sequelize.define('AssignmentSubmission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  assignment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'assignments', key: 'id' }
  },
  institute_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'institutes', key: 'id' }
  },
  student_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  files: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ id, name, url, public_id, size, type }]'
  },
  submitted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  marks: {
    type: DataTypes.FLOAT
  },
  grade: {
    type: DataTypes.STRING
  },
  feedback: {
    type: DataTypes.TEXT
  },
  graded_at: {
    type: DataTypes.DATE
  },
  graded_by: {
    type: DataTypes.UUID
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'late', 'graded'),
    defaultValue: 'draft'
  },
  submission_text: {
    type: DataTypes.TEXT
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  is_resubmission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  // backend/src/models/postgres/AssignmentSubmission.model.js
  // Add these fields

  submission_text: {
    type: DataTypes.TEXT,
    comment: 'Text response from student'
  },
  submission_type: {
    type: DataTypes.ENUM('text', 'file', 'mixed'),
    defaultValue: 'mixed'
  },
  plagiarism_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Plagiarism detection score (0-100)'
  },
  teacher_comments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Inline comments on submission'
  },
  reviewed_by_peer: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Student ID who reviewed this submission'
  },
  peer_review_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  peer_review_comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resubmission_deadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  auto_graded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  auto_grade_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'assignment_submissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

AssignmentSubmission.associate = (models) => {
  AssignmentSubmission.belongsTo(models.Assignment, { foreignKey: 'assignment_id', as: 'assignment' });
  AssignmentSubmission.belongsTo(models.User, { foreignKey: 'student_id', as: 'student' });
  AssignmentSubmission.belongsTo(models.User, { foreignKey: 'graded_by', as: 'grader' });
};

export default AssignmentSubmission;