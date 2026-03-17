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