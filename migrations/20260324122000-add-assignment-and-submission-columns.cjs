'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const describeSafe = async (tableName) => {
      try {
        return await queryInterface.describeTable(tableName);
      } catch (error) {
        return null;
      }
    };

    const addIfMissing = async (tableName, columnName, definition) => {
      const table = await describeSafe(tableName);
      if (!table) return;
      if (!table[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
      }
    };

    // assignments table new columns
    await addIfMissing('assignments', 'late_submission_penalty', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: 'Percentage penalty for late submission'
    });

    await addIfMissing('assignments', 'max_file_size', {
      type: Sequelize.INTEGER,
      defaultValue: 50,
      comment: 'Max file size in MB'
    });

    await addIfMissing('assignments', 'allowed_file_types', {
      type: Sequelize.JSONB,
      defaultValue: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'zip'],
      comment: 'Allowed file extensions'
    });

    await addIfMissing('assignments', 'max_files', {
      type: Sequelize.INTEGER,
      defaultValue: 10,
      comment: 'Maximum number of files per submission'
    });

    await addIfMissing('assignments', 'peer_review_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addIfMissing('assignments', 'plagiarism_check', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addIfMissing('assignments', 'rubric', {
      type: Sequelize.JSONB,
      defaultValue: null,
      comment: 'Grading rubric structure'
    });

    await addIfMissing('assignments', 'feedback_template', {
      type: Sequelize.TEXT,
      comment: 'Template for teacher feedback'
    });

    await addIfMissing('assignments', 'estimated_time', {
      type: Sequelize.INTEGER,
      comment: 'Estimated time in minutes'
    });

    await addIfMissing('assignments', 'difficulty_level', {
      type: Sequelize.ENUM('beginner', 'intermediate', 'advanced', 'expert'),
      defaultValue: 'intermediate'
    });

    // assignment_submissions table new columns
    await addIfMissing('assignment_submissions', 'submission_type', {
      type: Sequelize.ENUM('text', 'file', 'mixed'),
      defaultValue: 'mixed'
    });

    await addIfMissing('assignment_submissions', 'plagiarism_score', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      comment: 'Plagiarism detection score (0-100)'
    });

    await addIfMissing('assignment_submissions', 'teacher_comments', {
      type: Sequelize.JSONB,
      defaultValue: [],
      comment: 'Inline comments on submission'
    });

    await addIfMissing('assignment_submissions', 'reviewed_by_peer', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Student ID who reviewed this submission',
      references: { model: 'users', key: 'id' }
    });

    await addIfMissing('assignment_submissions', 'peer_review_score', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await addIfMissing('assignment_submissions', 'peer_review_comments', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await addIfMissing('assignment_submissions', 'resubmission_deadline', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await addIfMissing('assignment_submissions', 'auto_graded', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addIfMissing('assignment_submissions', 'auto_grade_score', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
  },

  async down(queryInterface) {
    const describeSafe = async (tableName) => {
      try {
        return await queryInterface.describeTable(tableName);
      } catch (error) {
        return null;
      }
    };

    const removeIfExists = async (tableName, columnName) => {
      const table = await describeSafe(tableName);
      if (!table) return;
      if (table[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
      }
    };

    await removeIfExists('assignments', 'late_submission_penalty');
    await removeIfExists('assignments', 'max_file_size');
    await removeIfExists('assignments', 'allowed_file_types');
    await removeIfExists('assignments', 'max_files');
    await removeIfExists('assignments', 'peer_review_enabled');
    await removeIfExists('assignments', 'plagiarism_check');
    await removeIfExists('assignments', 'rubric');
    await removeIfExists('assignments', 'feedback_template');
    await removeIfExists('assignments', 'estimated_time');
    await removeIfExists('assignments', 'difficulty_level');

    await removeIfExists('assignment_submissions', 'submission_type');
    await removeIfExists('assignment_submissions', 'plagiarism_score');
    await removeIfExists('assignment_submissions', 'teacher_comments');
    await removeIfExists('assignment_submissions', 'reviewed_by_peer');
    await removeIfExists('assignment_submissions', 'peer_review_score');
    await removeIfExists('assignment_submissions', 'peer_review_comments');
    await removeIfExists('assignment_submissions', 'resubmission_deadline');
    await removeIfExists('assignment_submissions', 'auto_graded');
    await removeIfExists('assignment_submissions', 'auto_grade_score');

    // Cleanup enum types in Postgres if they are no longer referenced.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_assignments_difficulty_level";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_assignment_submissions_submission_type";');
  }
};
