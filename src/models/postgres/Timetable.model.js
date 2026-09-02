// backend/src/models/Timetable.model.js

/**
 * The Clouds Academy - Timetable Model
 * 
 * Yeh model timetable ki poori information store karta hai:
 * - entity_type aur entity_ids se pata chalta hai ke kis class/course/batch ke liye hai
 * - period_config mein periods aur breaks ki timing store hoti hai
 * - slots array mein har din ke har period ka data store hota hai
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const Timetable = sequelize.define(
  'Timetable',
  {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true,
      comment: 'Har timetable ki unique ID' 
    },

    school_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Kis institute ka timetable hai (FK → institutes.id)'
    },

    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Optional branch for this timetable (FK → branches.id)'
    },

    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'academic_years', key: 'id' },
      comment: 'Kis academic year ke liye timetable hai'
    },

    // 🔥 IMPORTANT: entity_type batata hai ke yeh kis type ka institute hai
    entity_type: {
      type: DataTypes.ENUM('school', 'coaching', 'academy', 'college', 'university'),
      allowNull: false,
      comment: 'Institute type: school | coaching | academy | college | university'
    },

    // 🔥 IMPORTANT: entity_ids JSON mein store karta hai ke kis class/course ke liye hai
    entity_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: `Entity IDs based on institute type:
        - school: { class_id, section_id }
        - coaching: { course_id, batch_id }
        - academy: { program_id, batch_id }
        - college: { department_id, program_id, semester_id }
        - university: { faculty_id, department_id, program_id, semester_id }`
    },

    // Basic Info
    name: { 
      type: DataTypes.STRING(200), 
      allowNull: false,
      comment: 'Timetable ka naam e.g. "Class 1 - Section A Timetable"' 
    },

    description: { 
      type: DataTypes.TEXT,
      comment: 'Koi extra description agar zaroori ho'
    },

    effective_from: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW,
      comment: 'Yeh timetable kab se applicable hai'
    },

    effective_to: { 
      type: DataTypes.DATE,
      comment: 'Yeh timetable kab tak applicable hai (null means indefinite)'
    },

    is_active: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true,
      comment: 'Yeh timetable active hai ya nahi'
    },

    // 🔥 PERIOD CONFIG - User khud periods define karega
    period_config: {
      type: DataTypes.JSONB,
      defaultValue: {
        total_periods: 8,
        periods: [], // User defined periods
        breaks: []   // User defined breaks
      },
      comment: `Periods ka configuration:
        - total_periods: Total kitne periods hain
        - periods: Array of { period, start_time, end_time, name, type }
        - breaks: Array of { name, start_time, end_time }
        - type: 'study' ya 'break'`
    },

    // 🔥 SLOTS - Yahan saare slots store hote hain
    slots: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: `Timetable ke saare slots:
        [{
          id: uuid,
          day: monday|tuesday|...,
          period: period_number,
          start_time: "08:00",
          end_time: "08:40",
          subject_id: uuid,
          subject_name: string,
          teacher_id: uuid,
          teacher_name: string,
          room_no: string,
          is_break: boolean,
          break_name: string,
          created_at: timestamp,
          updated_at: timestamp
        }]`
    },

    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne yeh timetable banaya'
    },

    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Kis user ne last update kiya'
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Kab banaya gaya'
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Kab update kiya gaya'
    }
  },
  {
    tableName: 'timetables',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['school_id'] },
      { fields: ['academic_year_id'] },
      { fields: ['entity_type'] },
      { fields: ['entity_ids'], using: 'gin' }, // JSONB ke liye GIN index
      { fields: ['is_active'] },
      { fields: ['slots'], using: 'gin' }, // Slots array ke liye GIN index
      {
        name: 'idx_timetables_entity_lookup',
        fields: ['school_id', 'academic_year_id', 'entity_type']
      }
    ],
  }
);

Timetable.associate = (models) => {
  Timetable.belongsTo(models.Institute, { foreignKey: 'school_id', as: 'institute' });
  Timetable.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  Timetable.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academicYear' });
  Timetable.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Timetable.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
};

export default Timetable;