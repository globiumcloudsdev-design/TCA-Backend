// backend/src/models/postgres/Assignment.model.js

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Assignment = sequelize.define('Assignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  institute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'institutes', key: 'id' }
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' }
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  class_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'classes', key: 'id' }
  },
  section_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'sections', key: 'id' }
  },
  academic_year_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'academic_years', key: 'id' }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  target_type: {
    type: DataTypes.ENUM('class', 'section', 'batch', 'individual', 'all'),
    defaultValue: 'class'
  },
  target_ids: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of class/section/batch IDs'
  },
  type: {
    type: DataTypes.ENUM('homework', 'assignment', 'project', 'quiz'),
    defaultValue: 'homework'
  },
  subject: {
    type: DataTypes.STRING
  },
  subject_id: {
    type: DataTypes.UUID
  },
  due_date: {
    type: DataTypes.DATEONLY
  },
  due_time: {
    type: DataTypes.STRING
  },
  total_marks: {
    type: DataTypes.INTEGER
  },
  passing_marks: {
    type: DataTypes.INTEGER
  },
  grading_type: {
    type: DataTypes.ENUM('marks', 'grades', 'pass_fail'),
    defaultValue: 'marks'
  },
  instructions: {
    type: DataTypes.TEXT
  },
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ id, name, url, public_id, size, type }]'
  },
  resources: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: '[{ title, url, type }]'
  },
  allow_late_submission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  late_submission_days: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  },
  assigned_on: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  published_at: {
    type: DataTypes.DATE
  },
  stats: {
    type: DataTypes.JSONB,
    defaultValue: {
      total_students: 0,
      submitted: 0,
      pending: 0,
      graded: 0,
      average_score: 0
    }
  },
  created_by: {
    type: DataTypes.UUID
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // Add to the model definition:
  allow_late_submission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  late_submission_penalty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Percentage penalty for late submission'
  },
  max_file_size: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    comment: 'Max file size in MB'
  },
  allowed_file_types: {
    type: DataTypes.JSONB,
    defaultValue: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'zip'],
    comment: 'Allowed file extensions'
  },
  max_files: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Maximum number of files per submission'
  },
  peer_review_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  plagiarism_check: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rubric: {
    type: DataTypes.JSONB,
    defaultValue: null,
    comment: 'Grading rubric structure'
  },
  feedback_template: {
    type: DataTypes.TEXT,
    comment: 'Template for teacher feedback'
  },
  estimated_time: {
    type: DataTypes.INTEGER,
    comment: 'Estimated time in minutes'
  },
  difficulty_level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'expert'),
    defaultValue: 'intermediate'
  }
}, {
  tableName: 'assignments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

Assignment.associate = (models) => {
  Assignment.belongsTo(models.Institute, { foreignKey: 'institute_id', as: 'institute' });
  Assignment.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'teacher' });
  Assignment.belongsToMany(models.User, {
    through: 'assignment_submissions',
    foreignKey: 'assignment_id',
    otherKey: 'student_id',
    as: 'submissions'
  });
};

export default Assignment;