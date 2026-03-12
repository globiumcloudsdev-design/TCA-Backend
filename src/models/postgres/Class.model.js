
/**
 * The Clouds Academy - Class Model (Single Model Approach)
 * 
 * All data (sections, courses, materials) stored in JSONB columns
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';


const Class = sequelize.define(
  'Class',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    school_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'institutes', key: 'id' },
      onDelete: 'CASCADE',
    },
    
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Populated only when the school has branches enabled',
    },

    // Basic Class Info
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
    grade_level: { type: DataTypes.INTEGER, comment: 'Numeric grade e.g. 1, 5, 10' },
    fee_structure: { type: DataTypes.JSONB, defaultValue: {} },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    
    // Academic Year reference
    academic_year_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'academic_years', key: 'id' },
    },
    // --- NESTED DATA (JSONB Columns) ---
    
    // Sections array - Level 2
    sections: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of sections with name, room_no, capacity, is_active'
    },

    // Courses array with nested materials - Level 3 & 4
    courses: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of courses with name, code, materials array'
    },

    // Metadata
    total_sections: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.sections?.length || 0;
      }
    },

    total_courses: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.courses?.length || 0;
      }
    },

    total_materials: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.courses?.reduce((acc, course) => 
          acc + (course.materials?.length || 0), 0) || 0;
      }
    }
  },
  {
    tableName: 'classes',
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['school_id', 'academic_year_id', 'branch_id', 'name'],
        where: { deleted_at: null },
      },
      // GIN indexes for JSONB queries
      {
        fields: ['sections'],
        using: 'gin',
      },
      {
        fields: ['courses'],
        using: 'gin',
      }
    ],
  }
);

Class.associate = (models) => {
  Class.belongsTo(models.School, { foreignKey: 'school_id' });
  Class.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'AcademicYear' });
  Class.belongsTo(models.User, { foreignKey: 'class_teacher_id', as: 'ClassTeacher' });
};

export default Class;