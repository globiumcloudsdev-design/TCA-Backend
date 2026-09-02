/**
 * The Clouds Academy - AcademicYear Model
 * 
 * File: /src/models/postgres/academicYear.model.js
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AcademicYear = sequelize.define(
  'AcademicYear',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    institute_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'institutes',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'Institute this academic year belongs to',
    },

    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'branches',
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'Optional branch this academic year is scoped to (null for institute-wide)',
    },
    
    name: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'e.g. "2024-2025"',
    },
    
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    
    is_current: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'academic_years',
    paranoid: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['institute_id', 'name'],
        where: { deleted_at: null },
      }
    ],
  }
);

AcademicYear.associate = (models) => {
  AcademicYear.belongsTo(models.Institute, {
    foreignKey: 'institute_id',
    as: 'institute',
  });

  AcademicYear.belongsTo(models.Branch, {
    foreignKey: 'branch_id',
    as: 'branch',
  });
  
  AcademicYear.hasMany(models.Class, {
    foreignKey: 'academic_year_id',
    as: 'classes',
  });
};

export default AcademicYear;