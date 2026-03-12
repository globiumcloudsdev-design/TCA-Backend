/**
 * The Clouds Academy - InstituteType Model
 *
 * Lookup table for types of institutes that can register on the platform.
 * Types: School, College, Academy, University, Coaching, Tuition Center
 *
 * Uses INTEGER PK (not UUID) — it's a small static reference table.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const InstituteType = sequelize.define(
  'InstituteType',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'e.g. School, College, Academy, University, Coaching, Tuition Center',
    },

    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'URL-friendly key e.g. school, college, academy',
    },

    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Icon name / emoji e.g. 🏫 🎓 📚',
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Display order in UI dropdowns',
    },
  },
  {
    tableName: 'institute_types',
    timestamps: true,
    underscored: true,
  }
);

InstituteType.associate = (models) => {
  InstituteType.hasMany(models.Institute, {
    foreignKey: 'institute_type_id',
    as: 'institutes',
  });
};

export default InstituteType;
